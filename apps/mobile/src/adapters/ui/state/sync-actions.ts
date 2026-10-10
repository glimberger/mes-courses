import { StorageFull } from '../../../application/ports/storage-full';
import type { ConnectError } from '../../../application/use-cases/connect-to-server';
import type { SyncResult } from '../../../application/use-cases/synchronize';
import { err, ok, type Result } from '../../../domain/result';
import type { StoreKit, SyncSlice, WriteFailed } from './store-kit';
import { UnexpectedResult } from './unexpected-result';

/** The actions of the `sync` slice (research R14). */
export type SyncActions = {
  /**
   * Runs one cycle: sets the slice, reloads the regions when rows were pulled, and reacts to what
   * the pull removed (R10a). `failed` is true when the cycle ended in `waiting` or `failed`.
   */
  syncNow: () => Promise<{ failed: boolean }>;
  /** "Réessayer" on a failed status: runs a cycle at once (US3-4). */
  retry: () => Promise<{ failed: boolean }>;
  /** Tells the user a pull removed what a form was editing; the form then closes itself. */
  noticeRemoteRemoval: (reason: 'articleDeleted' | 'itemRemoved') => void;
  /** Pairs this device with a server (US4-4). */
  connectToServer: (
    url: string,
    code: string,
    deviceName: string,
  ) => Promise<
    Result<void, Exclude<ConnectError, { type: 'StorageFailed' }> | WriteFailed>
  >;
};

/** Failures in a row (5xx, unexpected response, unverifiable certificate) before `failed`. */
const FAILURES_BEFORE_FAILED = 3;

export const createSyncActions = ({
  get,
  set,
  useCases,
  report,
  releaseOffer,
  endedRemotely,
  onLocalWrite,
}: StoreKit): SyncActions => {
  const setSync = (partial: Partial<SyncSlice>) =>
    set({ sync: { ...get().sync, ...partial } });

  let failureStreak = 0;
  let failureReported = false;
  let storageFullShown = false;
  let inFlight: Promise<{ failed: boolean }> | null = null;

  /**
   * Reads the address, the last sync and, unless `keepConnection`, the connection; a failed read
   * keeps what is shown.
   */
  const loadSyncInfo = async (keepConnection = false) => {
    try {
      const info = await useCases.getSyncInfo();
      setSync({
        serverUrl: info.serverUrl,
        lastSyncAt: info.lastSyncAt,
        pendingCount: info.pendingCount,
        ...(!keepConnection && { connection: info.connection }),
      });
    } catch (error) {
      report(error, 'getSyncInfo');
    }
  };

  /**
   * A pull deleted or merged away the article (or the list) of the pending undo offer: the offer
   * ends, since restoring would clash with what the pull left (research R10a).
   */
  const endOfferOfDeleted = ({
    deletedArticles,
    merges,
  }: SyncResult['effects']) => {
    const offer = get().pendingUndo;
    if (offer === null) return;
    const articleId =
      offer.kind === 'removedItem'
        ? offer.removed.articleId
        : offer.deleted.article.id;
    const listIds: string[] =
      offer.kind === 'removedItem'
        ? [offer.removed.listId]
        : offer.deleted.items.map(({ listId }) => listId);
    const categoryId =
      offer.kind === 'deletedArticle' ? offer.deleted.article.categoryId : null;
    const gone =
      deletedArticles.includes(articleId) ||
      merges.some(
        ({ kind, loserId }) =>
          (kind === 'article' && loserId === articleId) ||
          (kind === 'list' && listIds.includes(loserId)) ||
          (kind === 'category' && loserId === categoryId),
      );
    if (!gone) return;
    const { undoId } =
      offer.kind === 'removedItem' ? offer.removed : offer.deleted;
    set({ pendingUndo: null });
    releaseOffer(offer);
    endedRemotely.add(undoId);
  };

  /** Remembers the merges and tells the open forms what the pull removed (research R10a). */
  const publishEffects = (effects: SyncResult['effects']) => {
    // An idle cycle changes nothing: leave the slice alone so no subscriber wakes.
    if (
      effects.deletedArticles.length === 0 &&
      effects.removedItems.length === 0 &&
      effects.merges.length === 0
    ) {
      return;
    }
    const { redirects, remote } = get().sync;
    setSync({
      redirects: {
        ...redirects,
        ...Object.fromEntries(
          effects.merges.map(({ loserId, survivorId }) => [
            loserId,
            survivorId,
          ]),
        ),
      },
      remote: { cycle: remote.cycle + 1, effects },
    });
  };

  const applyOutcome = (result: SyncResult) => {
    const { outcome } = result;
    switch (outcome.type) {
      case 'saved':
        failureStreak = 0;
        failureReported = false;
        storageFullShown = false;
        setSync({ status: 'saved' });
        return;
      case 'waiting':
        // Offline or unreachable: never reported (FR-022).
        setSync({ status: 'waiting' });
        return;
      case 'failed': {
        failureStreak += 1;
        if (failureStreak < FAILURES_BEFORE_FAILED) {
          setSync({ status: 'waiting' });
          return;
        }
        setSync({ status: 'failed' });
        if (!failureReported) {
          failureReported = true;
          report(new UnexpectedResult(outcome.reason), 'sync');
        }
        return;
      }
      case 'disconnectedByServer':
      case 'updateRequired':
        setSync({ connection: outcome.type, status: 'waiting' });
        return;
      case 'notConnected':
        setSync({ connection: 'notConnected', status: 'saved' });
        return;
      default:
        outcome satisfies never;
    }
  };

  const cycle = async (): Promise<{ failed: boolean }> => {
    setSync({ status: 'sending' });
    let result: SyncResult;
    try {
      result = await useCases.synchronize();
    } catch (error) {
      if (error instanceof StorageFull) {
        // The pull did not fit: waiting, told once per streak and never reported (001 FR-030).
        setSync({ status: 'waiting' });
        if (!storageFullShown) {
          storageFullShown = true;
          set({ notice: { type: 'storageFull' } });
        }
      } else {
        failureStreak += 1;
        setSync({
          status: failureStreak < FAILURES_BEFORE_FAILED ? 'waiting' : 'failed',
        });
        report(error, 'sync');
      }
      return { failed: true };
    }
    applyOutcome(result);
    endOfferOfDeleted(result.effects);
    try {
      if (result.pulledRows > 0) await get().refresh();
    } finally {
      // After the refresh, so a form that closes lands on screens already showing the pull; and
      // even when it fails, so the merges and removals of this cycle are not lost.
      publishEffects(result.effects);
    }
    // `disconnectedByServer` and `updateRequired` come from the cycle, which knows more.
    await loadSyncInfo(
      result.outcome.type === 'disconnectedByServer' ||
        result.outcome.type === 'updateRequired',
    );
    // A write made during the cycle is still waiting, though the cycle itself succeeded.
    const { status, pendingCount } = get().sync;
    if (status === 'saved' && pendingCount > 0) setSync({ status: 'waiting' });
    return {
      // A revoked or outdated app backs off like a failing one, instead of asking every 5 s. An
      // unpaired one has nothing to send and shows no status, so it keeps the base delay.
      failed:
        result.outcome.type !== 'saved' &&
        result.outcome.type !== 'notConnected',
    };
  };

  const syncNow: SyncActions['syncNow'] = () => {
    // One cycle at a time: a caller during a cycle shares it.
    inFlight ??= cycle().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const connectToServer: SyncActions['connectToServer'] = async (
    url,
    code,
    deviceName,
  ) => {
    let outcome: Result<void, ConnectError>;
    try {
      outcome = await useCases.connectToServer(url, code, deviceName);
    } catch (error) {
      set({ notice: { type: 'writeFailed' } });
      report(error, 'connectToServer', 'ConnectServer');
      return err({ type: 'WriteFailed' });
    }
    if (!outcome.ok) {
      const { type } = outcome.error;
      if (type === 'UntrustedServer' || type === 'StorageFailed') {
        // Only the tag is reported, never the address the user typed (FR-019, 001 FR-030).
        report(new UnexpectedResult(type), 'connectToServer', 'ConnectServer');
      }
      if (outcome.error.type === 'StorageFailed') {
        set({ notice: { type: 'writeFailed' } });
        return err({ type: 'WriteFailed' });
      }
      return err(outcome.error);
    }
    failureStreak = 0;
    failureReported = false;
    await loadSyncInfo();
    set({ notice: { type: 'deviceConnected' } });
    // The first cycle starts soon, not after the current delay.
    onLocalWrite();
    return ok(undefined);
  };

  const noticeRemoteRemoval: SyncActions['noticeRemoteRemoval'] = (reason) => {
    // The form is closing: the user must be told why. Only the storage-full notice, shown once
    // per streak, is kept.
    if (get().notice?.type === 'storageFull') return;
    set({
      notice: {
        type:
          reason === 'articleDeleted'
            ? 'articleDeletedElsewhere'
            : 'itemRemovedElsewhere',
      },
    });
  };

  return { syncNow, retry: syncNow, connectToServer, noticeRemoteRemoval };
};
