import { StorageFull } from '../../../application/ports/storage-full';
import type { ChooseInitialPasswordError } from '../../../application/use-cases/choose-initial-password';
import type {
  SignInError,
  SignInResult,
} from '../../../application/use-cases/sign-in';
import type { SyncResult } from '../../../application/use-cases/synchronize';
import { err, ok, type Result } from '../../../domain/result';
import { reactToFailure } from './failure-reactions';
import { createDeviceActions, type DeviceActions } from './device-actions';
import type { StoreKit, SyncSlice, WriteFailed } from './store-kit';
import { UnexpectedResult } from './unexpected-result';

/** The actions of the `sync` slice (research R14). */
export type SyncActions = DeviceActions & {
  /**
   * Runs one cycle: sets the slice, reloads the regions when rows were pulled, and reacts to what
   * the pull removed (R10a). `failed` is true when the cycle ended in `waiting` or `failed`.
   */
  syncNow: () => Promise<{ failed: boolean; slow?: boolean }>;
  /** "Réessayer" on a failed status: runs a cycle at once (US3-4). */
  retry: () => Promise<{ failed: boolean; slow?: boolean }>;
  /**
   * The user read the "signed out" message: the local copy is erased and the device returns to a
   * first launch (US5-4, US6-5, FR-017).
   */
  acknowledgeSignedOut: () => Promise<Result<void, WriteFailed>>;
  /** Tells the user a pull removed what a form was editing; the form then closes itself. */
  noticeRemoteRemoval: (reason: 'articleDeleted' | 'itemRemoved') => void;
  /** Signs this device in (US2-1). */
  signIn: (
    url: string,
    email: string,
    password: string,
    deviceName: string,
  ) => Promise<
    Result<
      SignInResult,
      Exclude<SignInError, { type: 'StorageFailed' }> | WriteFailed
    >
  >;
  /** Finishes the first sign-in with the password the person chose (US2-2). */
  chooseInitialPassword: (
    url: string,
    email: string,
    temporaryPassword: string,
    newPassword: string,
    confirmation: string,
    deviceName: string,
  ) => Promise<
    Result<
      void,
      | Exclude<ChooseInitialPasswordError, { type: 'StorageFailed' }>
      | WriteFailed
    >
  >;
};

/** Failures in a row (5xx, unexpected response, unverifiable certificate) before `failed`. */
const FAILURES_BEFORE_FAILED = 3;

export const createSyncActions = (kit: StoreKit): SyncActions => {
  const {
    get,
    set,
    useCases,
    report,
    releaseOffer,
    endedRemotely,
    onLocalWrite,
  } = kit;
  const setSync = (partial: Partial<SyncSlice>) =>
    set({ sync: { ...get().sync, ...partial } });

  let failureStreak = 0;
  let failureReported = false;
  let storageFullShown = false;
  let inFlight: Promise<{ failed: boolean; slow?: boolean }> | null = null;

  /**
   * Reads the address, the last sync and, unless `keepConnection`, the connection; a failed read
   * keeps what is shown.
   */
  const loadSyncInfo = async (keepConnection = false): Promise<boolean> => {
    try {
      const info = await useCases.getSyncInfo();
      setSync({
        serverUrl: info.serverUrl,
        lastSyncAt: info.lastSyncAt,
        pendingCount: info.pendingCount,
        ...(!keepConnection && {
          connection: info.connection,
          // A server address with no credential reads as a revoked device (003 FR-018b).
          signedOutReason: info.connection === 'signedOut' ? 'revoked' : null,
        }),
      });
      return true;
    } catch (error) {
      report(error, 'getSyncInfo');
      return false;
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
        // `saved` is set by the cycle, once it knows how many changes still wait.
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
      case 'signedOut':
        setSync({
          connection: 'signedOut',
          signedOutReason: outcome.reason,
          status: 'waiting',
        });
        return;
      case 'suspended':
        setSync({ connection: 'suspended', status: 'waiting' });
        return;
      case 'updateRequired':
        setSync({ connection: 'updateRequired', status: 'waiting' });
        return;
      case 'notConnected':
        setSync({ connection: 'notConnected', status: 'saved' });
        return;
      default:
        outcome satisfies never;
    }
  };

  const cycle = async (): Promise<{ failed: boolean; slow?: boolean }> => {
    // A device the server signed out has nothing to ask until it signs in again.
    if (get().sync.connection === 'signedOut')
      return { failed: false, slow: true };
    const before = get().sync.connection;
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
    // The refusals come from the cycle, which knows more; a suspended account stays so until a
    // cycle succeeds.
    await loadSyncInfo(
      result.outcome.type === 'signedOut' ||
        result.outcome.type === 'suspended' ||
        result.outcome.type === 'updateRequired' ||
        (before === 'suspended' && result.outcome.type !== 'saved'),
    );
    if (
      result.outcome.type === 'saved' &&
      get().sync.signedOutReason !== null
    ) {
      setSync({ signedOutReason: null });
    }
    if (result.outcome.type === 'saved') {
      // A write made during the cycle is still waiting, though the cycle itself succeeded. When
      // the count could not be read, the last known one stands (the failure is reported).
      setSync({
        status: get().sync.pendingCount > 0 ? 'waiting' : 'saved',
      });
    }
    if (result.outcome.type === 'suspended') {
      // Not a failure: the account comes back when the administrator lifts the suspension.
      return { failed: false, slow: true };
    }
    return {
      // An outdated app backs off like a failing one, instead of asking every 5 s. An unpaired
      // one has nothing to send and shows no status, so it keeps the base delay.
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

  /**
   * Reacts to what the sign-in use cases returned: a refused or outdated server changes the
   * connection or is reported as its tag alone, never the address, the email or a password
   * (Principle VIII, FR-020). Returns what the screen shows.
   */
  const settle = async <T, E extends { type: string }>(
    operation: 'signIn' | 'choosePassword',
    screen: 'SignIn' | 'ChoosePassword',
    run: () => Promise<Result<T, E>>,
  ): Promise<
    Result<T, Exclude<E, { type: 'StorageFailed' }> | WriteFailed>
  > => {
    let outcome: Result<T, E>;
    try {
      outcome = await run();
    } catch (error) {
      set({ notice: { type: 'writeFailed' } });
      report(error, operation, screen);
      return err({ type: 'WriteFailed' });
    }
    if (outcome.ok) return outcome;
    if (outcome.error.type === 'StorageFailed') {
      report(new UnexpectedResult('StorageFailed'), operation, screen);
      set({ notice: { type: 'writeFailed' } });
      return err({ type: 'WriteFailed' });
    }
    reactToFailure(kit, operation, screen, outcome.error);
    return err(outcome.error as Exclude<E, { type: 'StorageFailed' }>);
  };

  /** The device is signed in: the first cycle starts soon, not after the current delay. */
  const startSyncing = async (notice: 'signedIn' | 'passwordChosen') => {
    failureStreak = 0;
    failureReported = false;
    await loadSyncInfo();
    set({ notice: { type: notice } });
    onLocalWrite();
  };

  const signIn: SyncActions['signIn'] = async (url, email, password, name) => {
    const outcome = await settle('signIn', 'SignIn', () =>
      useCases.signIn(url, email, password, name),
    );
    if (outcome.ok && outcome.value.type === 'signedIn') {
      await startSyncing('signedIn');
    }
    return outcome;
  };

  const chooseInitialPassword: SyncActions['chooseInitialPassword'] = async (
    url,
    email,
    temporaryPassword,
    newPassword,
    confirmation,
    name,
  ) => {
    const outcome = await settle('choosePassword', 'ChoosePassword', () =>
      useCases.chooseInitialPassword(
        url,
        email,
        temporaryPassword,
        newPassword,
        confirmation,
        name,
      ),
    );
    if (outcome.ok) await startSyncing('passwordChosen');
    return outcome;
  };

  const acknowledgeSignedOut: SyncActions['acknowledgeSignedOut'] =
    async () => {
      // A cycle saving its state after the erasure would restore the old server fields.
      await inFlight?.catch(() => undefined);
      try {
        await useCases.acknowledgeSignedOut();
      } catch (error) {
        set({ notice: { type: 'writeFailed' } });
        report(error, 'acknowledgeSignedOut', 'SignedOutNotice');
        return err({ type: 'WriteFailed' });
      }
      failureStreak = 0;
      failureReported = false;
      set({ pendingUndo: null });
      setSync({
        connection: 'notConnected',
        signedOutReason: null,
        status: 'saved',
      });
      await loadSyncInfo();
      await get().refresh();
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

  const devices = createDeviceActions(kit, {
    loadSyncInfo,
    waitForCycle: async () => {
      // A failed cycle is not ours to report here: only its end matters.
      await inFlight?.catch(() => undefined);
    },
    setSync,
    resetFailures: () => {
      failureStreak = 0;
      failureReported = false;
    },
  });

  return {
    syncNow,
    retry: syncNow,
    signIn,
    chooseInitialPassword,
    acknowledgeSignedOut,
    noticeRemoteRemoval,
    ...devices,
  };
};
