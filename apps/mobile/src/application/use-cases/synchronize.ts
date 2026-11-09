import {
  MAX_CHANGES_PER_REQUEST,
  minHlc,
  nextHlc,
  receiveHlc,
  type Change,
  type ServerRow,
  type SyncRequest,
  type SyncResponse,
} from '@mes-courses/sync-core';

import type { ListId, ShoppingList } from '../../domain/shopping-list';
import type { Clock } from '../ports/clock';
import type { CredentialStore } from '../ports/credential-store';
import type { IdGenerator } from '../ports/id-generator';
import type { PendingChange } from '../ports/change-recorder';
import type { RemoteEffects } from '../ports/pulled-rows';
import type { Connection, SyncServer } from '../ports/sync-server';
import type { Repositories, UnitOfWork } from '../ports/unit-of-work';
import { resolveCurrentList } from './resolve-current-list';

/** Why a device is signed out by the server (data-model.md, connection state). */
export type SignedOutReason = 'revoked' | 'accountDeleted';

/** How a cycle ended (research R9, R14). */
export type SyncOutcome =
  | { type: 'saved' }
  | { type: 'waiting' }
  | { type: 'failed'; reason: 'ServerError' | 'UntrustedServer' }
  /** The server refuses this device for good; the data stays until `acknowledgeSignedOut`. */
  | { type: 'signedOut'; reason: SignedOutReason }
  /** The account is suspended: the data stays, the edits queue, the sync keeps trying slowly. */
  | { type: 'suspended' }
  | { type: 'updateRequired' }
  | { type: 'notConnected' };

export type SyncResult = {
  outcome: SyncOutcome;
  effects: RemoteEffects;
  /** The rows the server sent in this cycle; the store reloads its regions when above 0. */
  pulledRows: number;
};

const noEffects = (): RemoteEffects => ({
  deletedArticles: [],
  deletedLists: [],
  removedItems: [],
  merges: [],
});

/** The key of a field with a change still waiting: `<kind>:<id>:<field>`. */
const pendingKeys = (entries: PendingChange[]): Set<string> =>
  new Set(
    entries.flatMap((entry) =>
      Object.keys(entry.fields).map(
        (field) => `${entry.kind}:${entry.id}:${field}`,
      ),
    ),
  );

const toChange = ({ seq: _seq, ...change }: PendingChange): Change => change;

/**
 * Every local row as a change stamped with the minimum HLC of this device, so that anything
 * another device wrote wins over it (research R13). Categories first, then articles, lists and
 * items, so a reference is created after what it points at.
 */
const snapshotChanges = async (
  repos: Repositories,
  deviceId: string,
  ids: IdGenerator,
): Promise<Change[]> => {
  const hlc = minHlc(deviceId);
  const changes: Change[] = [];
  const add = (change: Omit<Change, 'changeId' | 'hlc'>) =>
    changes.push({ ...change, changeId: ids.next(), hlc } as Change);
  for (const category of await repos.categories.all()) {
    add({
      kind: 'category',
      id: category.id,
      fields: { name: category.name, position: category.position },
    });
  }
  for (const article of await repos.articles.all()) {
    add({
      kind: 'article',
      id: article.id,
      fields: { name: article.name, categoryId: article.categoryId },
    });
  }
  const lists = await repos.lists.all();
  for (const list of lists) {
    add({ kind: 'list', id: list.id, fields: { name: list.name } });
  }
  for (const list of lists) {
    for (const item of await repos.items.forList(list.id)) {
      add({
        kind: 'listItem',
        id: `${item.listId}:${item.articleId}`,
        fields: {
          listId: item.listId,
          articleId: item.articleId,
          present: true,
          inCart: item.inCart,
          quantity: item.quantity,
        },
      });
    }
  }
  return changes;
};

/**
 * Before a batch that deletes the current list is applied, moves the current list off it and
 * removes it (012 research R4), since `app_state` must refer to a stored list. Repeats while the
 * new current list is deleted by the same batch too. Live lists of the batch not stored yet count
 * as remaining, unless deleted here and still waiting to be sent.
 *
 * @returns the lists removed here, which the applier will no longer find, and the pulled list to
 * make current once the batch is stored, if any.
 */
const moveCurrentListOffDeleted = async (
  repos: Repositories,
  ids: IdGenerator,
  rows: ServerRow[],
  pending: Set<string>,
  firstListName: string,
): Promise<{ removed: string[]; makeCurrent: ListId | null }> => {
  const lists = rows.filter((row) => row.kind === 'list');
  const deleted = new Set(
    lists
      .filter((row) => row.deletedHlc !== null && row.mergedInto === null)
      .map((row) => row.id),
  );
  const removed: string[] = [];
  let makeCurrent: ListId | null = null;
  if (deleted.size === 0) return { removed, makeCurrent };

  const incoming: ShoppingList[] = [];
  for (const row of lists) {
    const name = row.fields.name?.value;
    if (
      row.deletedHlc === null &&
      name !== undefined &&
      !pending.has(`list:${row.id}:deleted`) &&
      !(await repos.lists.findById(row.id as ListId))
    ) {
      incoming.push({ id: row.id as ListId, name });
    }
  }
  for (;;) {
    const current = await repos.appState.currentListId();
    if (current === null || !deleted.has(current)) break;
    makeCurrent = await resolveCurrentList(repos, ids, {
      removing: current,
      incoming,
      firstListName,
    });
    removed.push(current);
  }
  return { removed, makeCurrent };
};

export const createSynchronize =
  ({
    unitOfWork,
    syncServer,
    credentials,
    clock,
    ids,
    firstListName,
  }: {
    unitOfWork: UnitOfWork;
    syncServer: SyncServer;
    credentials: CredentialStore;
    clock: Clock;
    ids: IdGenerator;
    /** The name of the list created when a pull deletes the last one (from the UI adapter, X). */
    firstListName: string;
  }) =>
  async (): Promise<SyncResult> => {
    const effects = noEffects();
    let pulledRows = 0;
    const finish = (outcome: SyncOutcome): SyncResult => ({
      outcome,
      effects,
      pulledRows,
    });

    const first = await unitOfWork.run((repos) => repos.syncState.get());
    if (first.serverUrl === null || first.deviceId === null) {
      return finish({ type: 'notConnected' });
    }
    const credential = await credentials.read();
    // A phone restored from a backup has the address but no credential (FR-018b).
    if (credential === null) {
      return finish({ type: 'signedOut', reason: 'revoked' });
    }
    const conn: Connection = {
      url: first.serverUrl,
      deviceId: first.deviceId,
      credential,
    };
    const deviceId = first.deviceId;

    let snapshot: Change[] = first.snapshotDone
      ? []
      : await unitOfWork.run((repos) => snapshotChanges(repos, deviceId, ids));
    let snapshotPending = !first.snapshotDone;

    for (;;) {
      const state = await unitOfWork.run((repos) => repos.syncState.get());

      const fromSnapshot = snapshot.slice(0, MAX_CHANGES_PER_REQUEST);
      const outbox: PendingChange[] =
        fromSnapshot.length > 0
          ? []
          : await unitOfWork.run((repos) =>
              repos.changes.pending(MAX_CHANGES_PER_REQUEST),
            );
      const changes =
        fromSnapshot.length > 0 ? fromSnapshot : outbox.map(toChange);

      const nowMs = clock.nowMs();
      const request: SyncRequest = {
        lastSeq: state.lastSeq,
        hlc: nextHlc({ ...state.maxHlc, deviceId }, nowMs),
        changes,
      };
      const answer = await syncServer.sync(conn, request);
      if (!answer.ok) {
        switch (answer.error.type) {
          case 'Offline':
            return finish({ type: 'waiting' });
          case 'DeviceNotAuthorized':
            return finish({ type: 'signedOut', reason: 'revoked' });
          case 'AccountDeleted':
            return finish({ type: 'signedOut', reason: 'accountDeleted' });
          case 'AccountSuspended':
            return finish({ type: 'suspended' });
          case 'UpdateRequired':
            return finish({ type: 'updateRequired' });
          case 'UntrustedServer':
            return finish({ type: 'failed', reason: 'UntrustedServer' });
          default:
            return finish({ type: 'failed', reason: 'ServerError' });
        }
      }
      const response: SyncResponse = answer.value;
      if (state.serverId !== null && response.serverId !== state.serverId) {
        return finish({ type: 'signedOut', reason: 'revoked' });
      }

      snapshot = snapshot.slice(fromSnapshot.length);
      const snapshotSent = snapshotPending && snapshot.length === 0;
      const acknowledged = new Set(response.acknowledged);
      const unacknowledged = changes.some(
        (change) => !acknowledged.has(change.changeId),
      );

      await unitOfWork.run(async (repos) => {
        await repos.changes.acknowledge(response.acknowledged);
        if (response.rows.length > 0) {
          // Held entries count too: a removal waiting for its undo offer must not be undone by a pull.
          const waiting = await repos.changes.pending(Number.MAX_SAFE_INTEGER, {
            includeHeld: true,
          });
          const pending = pendingKeys(waiting);
          const { removed, makeCurrent } = await moveCurrentListOffDeleted(
            repos,
            ids,
            response.rows,
            pending,
            firstListName,
          );
          const applied = await repos.pulledRows.apply(response.rows, pending);
          if (makeCurrent !== null) {
            await repos.appState.setCurrentListId(makeCurrent);
          }
          effects.deletedArticles.push(...applied.effects.deletedArticles);
          effects.deletedLists.push(
            ...removed,
            ...applied.effects.deletedLists,
          );
          effects.removedItems.push(...applied.effects.removedItems);
          effects.merges.push(...applied.effects.merges);
        }
        await repos.syncState.save({
          ...state,
          // The first response that names the account teaches it to a device paired before 004.
          accountId: state.accountId ?? response.accountId ?? null,
          lastSeq: response.seq,
          maxHlc: receiveHlc(
            { ...state.maxHlc, deviceId },
            response.hlc,
            clock.nowMs(),
          ),
          lastSyncAt: new Date(clock.nowMs()).toISOString(),
          snapshotDone: state.snapshotDone || (snapshotPending && snapshotSent),
        });
      });
      pulledRows += response.rows.length;
      if (snapshotSent) snapshotPending = false;

      if (unacknowledged) return finish({ type: 'waiting' });
      if (response.more === true) continue;
      // A snapshot batch leaves the outbox unread; a full outbox batch may have a successor.
      if (
        fromSnapshot.length > 0 ||
        outbox.length === MAX_CHANGES_PER_REQUEST
      ) {
        continue;
      }
      break;
    }

    const remaining = await unitOfWork.run((repos) => repos.changes.count());
    return finish({ type: remaining === 0 ? 'saved' : 'waiting' });
  };
