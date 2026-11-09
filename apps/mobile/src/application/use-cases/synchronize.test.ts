import {
  compareHlc,
  minHlc,
  type Change,
  type Hlc,
  type ServerRow,
  type SyncRequest,
  type SyncResponse,
} from '@mes-courses/sync-core';
import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { RemoteEffects } from '../ports/pulled-rows';
import type { SyncFailure, SyncServer } from '../ports/sync-server';
import { FakeClock } from '../testing/fake-clock';
import { InMemoryCredentialStore } from '../testing/in-memory-credential-store';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { createSynchronize } from './synchronize';

const NO_EFFECTS: RemoteEffects = {
  deletedArticles: [],
  deletedLists: [],
  removedItems: [],
  merges: [],
};

const serverHlc = (wallMs: number): Hlc => ({
  wallMs,
  counter: 0,
  deviceId: 'server',
});

const respond = (
  request: SyncRequest,
  overrides: Partial<SyncResponse> = {},
): SyncResponse => ({
  serverId: 'server-1',
  apiVersion: 1,
  minAppVersion: '1.0.0',
  acknowledged: request.changes.map((change) => change.changeId),
  rows: [],
  seq: request.lastSeq,
  hlc: serverHlc(1_000),
  ...overrides,
});

const listRow = (id: string, name: string, seq: number): ServerRow => ({
  kind: 'list',
  id,
  seq,
  fields: { name: { value: name, hlc: serverHlc(500) } },
  createdHlc: serverHlc(500),
  deletedHlc: null,
  mergedInto: null,
});

describe('synchronize', () => {
  let repositories: InMemoryRepositories;
  let unitOfWork: InMemoryUnitOfWork;
  let credentials: InMemoryCredentialStore;
  let clock: FakeClock;
  let ids: SequentialIdGenerator;
  let requests: SyncRequest[];
  let handler: (request: SyncRequest) => Result<SyncResponse, SyncFailure>;
  let syncServer: SyncServer;

  const synchronize = () =>
    createSynchronize({
      unitOfWork,
      syncServer,
      credentials,
      clock,
      ids,
      firstListName: 'Ma liste',
    })();
  const state = () => unitOfWork.run((repos) => repos.syncState.get());
  const pendingCount = () => unitOfWork.run((repos) => repos.changes.count());
  const connect = async (overrides: { snapshotDone?: boolean } = {}) => {
    await unitOfWork.run(async (repos) => {
      await repos.syncState.save({
        ...(await repos.syncState.get()),
        serverUrl: 'https://courses.example.fr',
        serverId: 'server-1',
        deviceId: 'device-1',
        snapshotDone: overrides.snapshotDone ?? true,
      });
    });
    await credentials.write('secret-credential');
  };
  const record = (
    kind: 'list' | 'listItem',
    id: string,
    fields: object,
    options?: { heldBy?: string },
  ) =>
    unitOfWork.run((repos) => repos.changes.record(kind, id, fields, options));
  const sentChanges = (): Change[] => requests.flatMap((r) => r.changes);

  beforeEach(() => {
    clock = new FakeClock(2_000);
    ids = new SequentialIdGenerator();
    repositories = new InMemoryRepositories({ clock, ids });
    unitOfWork = new InMemoryUnitOfWork(repositories);
    credentials = new InMemoryCredentialStore();
    requests = [];
    handler = (request) => ok(respond(request));
    syncServer = {
      sync: async (_conn, request) => {
        requests.push(structuredClone(request));
        return handler(request);
      },
    } as SyncServer;
  });

  describe('when it cannot run', () => {
    it('answers notConnected, with no request, when there is no serverUrl', async () => {
      const result = await synchronize();

      expect(result).toEqual({
        outcome: { type: 'notConnected' },
        effects: NO_EFFECTS,
        pulledRows: 0,
      });
      expect(requests).toEqual([]);
    });

    it('FR-018b answers signedOut (revoked), with no request, when the credential is gone', async () => {
      await connect();
      await credentials.clear();
      await record('list', 'l-1', { name: 'Ma liste' });
      const before = await state();

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'signedOut', reason: 'revoked' });
      expect(requests).toEqual([]);
      expect(await pendingCount()).toBe(1);
      expect(await state()).toEqual(before);
    });
  });

  describe('push', () => {
    it('US1-3 pushes the outbox entries in order, with the connection and the device HLC', async () => {
      await connect();
      await record('list', 'l-1', { name: 'Première' });
      await record('list', 'l-2', { name: 'Deuxième' });
      const connections: unknown[] = [];
      syncServer.sync = async (conn, request) => {
        connections.push(conn);
        requests.push(structuredClone(request));
        return ok(respond(request));
      };

      await synchronize();

      expect(connections[0]).toEqual({
        url: 'https://courses.example.fr',
        deviceId: 'device-1',
        credential: 'secret-credential',
      });
      expect(requests).toHaveLength(1);
      expect(requests[0]?.lastSeq).toBe(0);
      expect(requests[0]?.changes.map((change) => change.id)).toEqual([
        'l-1',
        'l-2',
      ]);
      expect(requests[0]?.hlc.deviceId).toBe('device-1');
    });

    it('US1-3 sends batches of at most 500 until the outbox is empty', async () => {
      await connect();
      for (let i = 0; i < 1_200; i += 1) {
        await record('list', `l-${i}`, { name: `Liste ${i}` });
      }

      const result = await synchronize();

      expect(requests.map((request) => request.changes.length)).toEqual([
        500, 500, 200,
      ]);
      expect(sentChanges().map((change) => change.id)).toEqual(
        Array.from({ length: 1_200 }, (_, i) => `l-${i}`),
      );
      expect(await pendingCount()).toBe(0);
      expect(result.outcome).toEqual({ type: 'saved' });
    });

    it('does not send held entries', async () => {
      await connect();
      await record('list', 'l-1', { name: 'Gardée' }, { heldBy: 'undo-1' });
      await record('list', 'l-2', { name: 'Envoyée' });

      await synchronize();

      expect(sentChanges().map((change) => change.id)).toEqual(['l-2']);
    });

    it('still pulls when the outbox is empty', async () => {
      await connect();

      const result = await synchronize();

      expect(requests).toHaveLength(1);
      expect(requests[0]?.changes).toEqual([]);
      expect(result.outcome).toEqual({ type: 'saved' });
    });
  });

  describe('the first cycle (snapshot)', () => {
    const seedLocalData = () =>
      unitOfWork.run(async (repos) => {
        await repos.categories.add({
          id: 'c-1' as CategoryId,
          name: 'Fruits',
          position: 0,
        });
        await repos.articles.add({
          id: 'a-1' as ArticleId,
          name: 'Pommes',
          categoryId: 'c-1' as CategoryId,
        });
        await repos.lists.add({ id: 'l-1' as ListId, name: 'Ma liste' });
        await repos.items.save({
          listId: 'l-1' as ListId,
          articleId: 'a-1' as ArticleId,
          inCart: true,
          quantity: { amount: 2, unit: 'kg' },
        });
      });

    it('R13 US1-6 pushes every local row stamped with the minimum HLC before the outbox, then sets snapshotDone', async () => {
      await connect({ snapshotDone: false });
      await seedLocalData();
      await record('list', 'l-2', { name: 'Dans la boîte' });

      const result = await synchronize();

      const changes = sentChanges();
      const snapshot = changes.slice(0, 4);
      expect(snapshot.map((change) => [change.kind, change.id])).toEqual([
        ['category', 'c-1'],
        ['article', 'a-1'],
        ['list', 'l-1'],
        ['listItem', 'l-1:a-1'],
      ]);
      for (const change of snapshot) {
        expect(change.hlc).toEqual(minHlc('device-1'));
      }
      expect(snapshot.map((change) => change.fields)).toEqual([
        { name: 'Fruits', position: 0 },
        { name: 'Pommes', categoryId: 'c-1' },
        { name: 'Ma liste' },
        {
          listId: 'l-1',
          articleId: 'a-1',
          present: true,
          inCart: true,
          quantity: { amount: 2, unit: 'kg' },
        },
      ]);
      expect(changes.slice(4).map((change) => change.id)).toEqual(['l-2']);
      expect(new Set(changes.map((change) => change.changeId)).size).toBe(
        changes.length,
      );
      expect((await state()).snapshotDone).toBe(true);
      expect(result.outcome).toEqual({ type: 'saved' });
    });

    it('R13 sends the snapshot in batches of at most 500', async () => {
      await connect({ snapshotDone: false });
      await unitOfWork.run(async (repos) => {
        for (let i = 0; i < 700; i += 1) {
          await repos.lists.add({ id: `l-${i}` as ListId, name: `Liste ${i}` });
        }
      });

      await synchronize();

      expect(requests.every((r) => r.changes.length <= 500)).toBe(true);
      expect(sentChanges()).toHaveLength(700);
    });

    it('R13 does not send the snapshot again once snapshotDone', async () => {
      await connect({ snapshotDone: false });
      await seedLocalData();
      await synchronize();
      requests = [];

      await synchronize();

      expect(sentChanges()).toEqual([]);
    });

    it('keeps snapshotDone false when the snapshot could not be sent', async () => {
      await connect({ snapshotDone: false });
      await seedLocalData();
      handler = () => err({ type: 'Offline' });

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'waiting' });
      expect((await state()).snapshotDone).toBe(false);
    });
  });

  describe('the response', () => {
    it('removes the acknowledged entries, applies the rows, saves lastSeq and the received HLC', async () => {
      await connect();
      await record('list', 'l-1', { name: 'Première' });
      const rows = [listRow('l-9', 'Venue du serveur', 7)];
      handler = (request) =>
        ok(respond(request, { rows, seq: 7, hlc: serverHlc(9_000) }));
      const apply = jest.spyOn(repositories.pulledRows, 'apply');

      const result = await synchronize();

      expect(apply).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledWith(rows, new Set());
      expect(await pendingCount()).toBe(0);
      const saved = await state();
      expect(saved.lastSeq).toBe(7);
      expect(compareHlc(saved.maxHlc, serverHlc(9_000))).toBeGreaterThan(0);
      expect(saved.maxHlc.deviceId).toBe('device-1');
      expect(saved.lastSyncAt).toBe(new Date(2_000).toISOString());
      expect(result.outcome).toEqual({ type: 'saved' });
    });

    it('keeps the entries the server did not acknowledge, and protects their fields from the pull', async () => {
      await connect();
      await record('list', 'l-1', { name: 'Première' });
      await record('list', 'l-2', { name: 'Deuxième' });
      handler = (request) =>
        ok(
          respond(request, {
            acknowledged: [request.changes[0]?.changeId ?? ''],
            rows: [listRow('l-2', 'Du serveur', 3)],
            seq: 3,
          }),
        );
      const apply = jest.spyOn(repositories.pulledRows, 'apply');

      await synchronize();

      expect(await pendingCount()).toBe(1);
      // The key of a pending field is `<kind>:<id>:<field>`.
      expect(apply).toHaveBeenCalledWith(
        expect.any(Array),
        new Set(['list:l-2:name']),
      );
    });

    it('pulls again while the server says there is more', async () => {
      await connect();
      const pages = [
        { rows: [listRow('l-1', 'Un', 4)], seq: 4, more: true },
        { rows: [listRow('l-2', 'Deux', 6)], seq: 6 },
      ];
      handler = (request) => ok(respond(request, pages.shift()));
      const apply = jest.spyOn(repositories.pulledRows, 'apply');

      await synchronize();

      expect(requests.map((r) => [r.lastSeq, r.changes.length])).toEqual([
        [0, 0],
        [4, 0],
      ]);
      expect(apply).toHaveBeenCalledTimes(2);
      expect((await state()).lastSeq).toBe(6);
    });

    it('returns the effects of the applier next to the outcome', async () => {
      await connect();
      const effects: RemoteEffects = {
        deletedArticles: ['a-1'],
        deletedLists: ['l-4'],
        removedItems: [{ listId: 'l-1', articleId: 'a-2' }],
        merges: [{ kind: 'list', loserId: 'l-2', survivorId: 'l-3' }],
      };
      handler = (request) =>
        ok(respond(request, { rows: [listRow('l-3', 'Ma liste', 5)], seq: 5 }));
      jest
        .spyOn(repositories.pulledRows, 'apply')
        .mockResolvedValue({ deferred: 0, effects });

      const result = await synchronize();

      expect(result).toEqual({
        outcome: { type: 'saved' },
        effects,
        pulledRows: 1,
      });
    });

    it('returns empty effects when nothing was pulled', async () => {
      await connect();

      const result = await synchronize();

      expect(result.effects).toEqual(NO_EFFECTS);
      expect(result.pulledRows).toBe(0);
    });
  });

  describe('lists renamed or deleted on another device (012 US3)', () => {
    const deletedRow = (id: string, name: string, seq: number): ServerRow => ({
      ...listRow(id, name, seq),
      deletedHlc: serverHlc(600),
    });
    /** Local lists, the first one current, with one item on each. */
    const seedLists = (...lists: [string, string][]) =>
      unitOfWork.run(async (repos) => {
        await repos.categories.add({
          id: 'c-1' as CategoryId,
          name: 'Fruits',
          position: 0,
        });
        await repos.articles.add({
          id: 'a-1' as ArticleId,
          name: 'Pommes',
          categoryId: 'c-1' as CategoryId,
        });
        for (const [id, name] of lists) {
          await repos.lists.add({ id: id as ListId, name });
          await repos.items.save({
            listId: id as ListId,
            articleId: 'a-1' as ArticleId,
            inCart: false,
            quantity: null,
          });
        }
        await repos.appState.setCurrentListId(lists[0]?.[0] as ListId);
      });
    const pull = (...rows: ServerRow[]) => {
      handler = (request) => ok(respond(request, { rows, seq: 9 }));
    };
    const current = () =>
      unitOfWork.run((repos) => repos.appState.currentListId());
    const listNames = () =>
      unitOfWork.run(async (repos) =>
        (await repos.lists.all()).map((l) => [l.id, l.name]),
      );

    it('FR-010 US3-3 a pull deleting the current list makes the first remaining list by name current, silently', async () => {
      await connect();
      await seedLists(['l-1', 'Ma liste'], ['l-3', 'Zoo'], ['l-2', 'barbecue']);
      pull(deletedRow('l-1', 'Ma liste', 9));

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'saved' });
      expect(await current()).toBe('l-2');
      expect(await listNames()).toEqual([
        ['l-3', 'Zoo'],
        ['l-2', 'barbecue'],
      ]);
      expect(result.effects.deletedLists).toEqual(['l-1']);
      expect(await pendingCount()).toBe(0);
    });

    it('FR-010 a pull deleting every list creates "Ma liste", records it and makes it current', async () => {
      await connect();
      await seedLists(['l-1', 'Ma liste'], ['l-2', 'Barbecue']);
      pull(deletedRow('l-1', 'Ma liste', 8), deletedRow('l-2', 'Barbecue', 9));

      const result = await synchronize();

      const lists = await listNames();
      expect(lists).toEqual([[expect.any(String), 'Ma liste']]);
      const [created] = lists[0] ?? [];
      expect(created).not.toBe('l-1');
      expect(await current()).toBe(created);
      expect(
        await unitOfWork.run((repos) => repos.changes.pending(10)),
      ).toEqual([
        expect.objectContaining({
          kind: 'list',
          id: created,
          fields: { name: 'Ma liste' },
        }),
      ]);
      expect([...result.effects.deletedLists].sort()).toEqual(['l-1', 'l-2']);
    });

    it('creates no default list when the same batch brings a live list, which becomes current', async () => {
      await connect();
      await seedLists(['l-1', 'Ma liste']);
      pull(deletedRow('l-1', 'Ma liste', 8), listRow('l-9', 'Fête', 9));

      const result = await synchronize();

      expect(await listNames()).toEqual([['l-9', 'Fête']]);
      expect(await current()).toBe('l-9');
      expect(await pendingCount()).toBe(0);
      expect(result.effects.deletedLists).toEqual(['l-1']);
    });

    it('a pulled list deleted here and waiting to be sent does not count as remaining', async () => {
      await connect();
      await seedLists(['l-1', 'Ma liste']);
      await record('list', 'l-9', { deleted: true });
      handler = (request) =>
        ok(
          respond(request, {
            acknowledged: [],
            rows: [deletedRow('l-1', 'Ma liste', 8), listRow('l-9', 'Fête', 9)],
            seq: 9,
          }),
        );

      await synchronize();

      const lists = await listNames();
      expect(lists).toEqual([[expect.any(String), 'Ma liste']]);
      expect(await current()).toBe(lists[0]?.[0]);
    });

    it('FR-010 a pull deleting the current list and the first one after it lands on the next', async () => {
      await connect();
      await seedLists(
        ['l-1', 'Ma liste'],
        ['l-2', 'Barbecue'],
        ['l-3', 'Courses'],
      );
      pull(deletedRow('l-1', 'Ma liste', 8), deletedRow('l-2', 'Barbecue', 9));

      await synchronize();

      expect(await current()).toBe('l-3');
      expect(await listNames()).toEqual([['l-3', 'Courses']]);
    });

    it('US3-2 a pull deleting another list leaves the current list', async () => {
      await connect();
      await seedLists(['l-1', 'Ma liste'], ['l-2', 'Barbecue']);
      pull(deletedRow('l-2', 'Barbecue', 9));

      const result = await synchronize();

      expect(await current()).toBe('l-1');
      expect(await listNames()).toEqual([['l-1', 'Ma liste']]);
      expect(result.effects.deletedLists).toEqual(['l-2']);
    });

    it('US3-1 a pulled rename updates the name, unless a local rename is pending', async () => {
      await connect();
      await seedLists(['l-1', 'Ma liste'], ['l-2', 'Barbecue']);
      await unitOfWork.run((repos) =>
        repos.lists.rename('l-1' as ListId, 'À moi'),
      );
      handler = (request) =>
        ok(
          respond(request, {
            acknowledged: [],
            rows: [
              listRow('l-1', 'Du serveur', 8),
              listRow('l-2', 'Grillades', 9),
            ],
            seq: 9,
          }),
        );
      await record('list', 'l-1', { name: 'À moi' });

      await synchronize();

      expect(await listNames()).toEqual([
        ['l-1', 'À moi'],
        ['l-2', 'Grillades'],
      ]);
    });

    it('FR-009 US3-4 a deletion beats a pending local rename of the list and edits of its items', async () => {
      await connect();
      await seedLists(['l-1', 'Ma liste'], ['l-2', 'Barbecue']);
      await record('list', 'l-2', { name: 'Grillades' });
      await record('listItem', 'l-2:a-1', { inCart: true });
      handler = (request) =>
        ok(
          respond(request, {
            acknowledged: [],
            rows: [deletedRow('l-2', 'Barbecue', 9)],
            seq: 9,
          }),
        );

      const result = await synchronize();

      expect(await listNames()).toEqual([['l-1', 'Ma liste']]);
      expect(result.effects.deletedLists).toEqual(['l-2']);
    });

    it('SC-003 after a snapshot, the tombstone the server sends back beats the minimum-HLC create', async () => {
      await connect({ snapshotDone: false });
      await seedLists(['l-1', 'Ma liste'], ['l-2', 'Barbecue']);
      pull(deletedRow('l-2', 'Barbecue', 9));

      await synchronize();

      expect(
        sentChanges()
          .filter((c) => c.kind === 'list')
          .map((c) => c.id),
      ).toEqual(['l-1', 'l-2']);
      expect(await listNames()).toEqual([['l-1', 'Ma liste']]);
      expect((await state()).snapshotDone).toBe(true);
    });

    it('VII a local deletion stays queued offline and leaves the outbox only once acknowledged', async () => {
      await connect();
      await seedLists(['l-1', 'Ma liste'], ['l-2', 'Barbecue']);
      await record('list', 'l-2', { deleted: true });
      handler = () => err({ type: 'Offline' });

      expect((await synchronize()).outcome).toEqual({ type: 'waiting' });
      expect(await pendingCount()).toBe(1);

      handler = (request) => ok(respond(request, { acknowledged: [] }));
      expect((await synchronize()).outcome).toEqual({ type: 'waiting' });
      expect(await pendingCount()).toBe(1);

      handler = (request) => ok(respond(request));
      expect((await synchronize()).outcome).toEqual({ type: 'saved' });
      expect(await pendingCount()).toBe(0);
      expect(sentChanges().at(-1)).toEqual(
        expect.objectContaining({
          kind: 'list',
          id: 'l-2',
          fields: { deleted: true },
        }),
      );
    });
  });

  describe('the account (004)', () => {
    it('004 US3-5 learns the account from the first response that names it, on a device paired before accounts', async () => {
      await connect();
      expect((await state()).accountId).toBeNull();
      handler = (request) => ok(respond(request, { accountId: 'account-1' }));

      await synchronize();

      expect((await state()).accountId).toBe('account-1');
    });

    it('004 keeps the account it knows when a later response names another', async () => {
      await connect();
      handler = (request) => ok(respond(request, { accountId: 'account-1' }));
      await synchronize();
      handler = (request) => ok(respond(request, { accountId: 'account-2' }));

      await synchronize();

      expect((await state()).accountId).toBe('account-1');
    });

    it('004 stays null while no response names an account', async () => {
      await connect();

      await synchronize();

      expect((await state()).accountId).toBeNull();
    });
  });

  describe('failures', () => {
    beforeEach(async () => {
      await connect();
      await record('list', 'l-1', { name: 'Première' });
    });

    it('US1-2 answers waiting on Offline, losing nothing', async () => {
      handler = () => err({ type: 'Offline' });
      const before = await state();

      const result = await synchronize();

      expect(result).toEqual({
        outcome: { type: 'waiting' },
        effects: NO_EFFECTS,
        pulledRows: 0,
      });
      expect(await pendingCount()).toBe(1);
      expect(await state()).toEqual(before);
    });

    it('FR-018a answers signedOut (revoked) on DeviceNotAuthorized, keeping every row and pending change', async () => {
      await unitOfWork.run((repos) =>
        repos.lists.add({ id: 'l-1' as ListId, name: 'Locale' }),
      );
      handler = () => err({ type: 'DeviceNotAuthorized' });

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'signedOut', reason: 'revoked' });
      expect(await pendingCount()).toBe(1);
      expect(await unitOfWork.run((repos) => repos.lists.all())).toHaveLength(
        1,
      );
    });

    it('FR-018a answers signedOut (revoked) when the serverId is not the one paired with', async () => {
      handler = (request) =>
        ok(
          respond(request, {
            serverId: 'server-2',
            rows: [listRow('l-9', 'Autre', 1)],
            seq: 1,
          }),
        );
      const apply = jest.spyOn(repositories.pulledRows, 'apply');
      const before = await state();

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'signedOut', reason: 'revoked' });
      expect(apply).not.toHaveBeenCalled();
      expect(await pendingCount()).toBe(1);
      expect(await state()).toEqual(before);
    });

    it('004 US5-4 answers signedOut(accountDeleted) on AccountDeleted, keeping every row and pending change', async () => {
      await unitOfWork.run((repos) =>
        repos.lists.add({ id: 'l-1' as ListId, name: 'Locale' }),
      );
      handler = () => err({ type: 'AccountDeleted' });

      const result = await synchronize();

      expect(result.outcome).toEqual({
        type: 'signedOut',
        reason: 'accountDeleted',
      });
      expect(await pendingCount()).toBe(1);
      expect(await unitOfWork.run((repos) => repos.lists.all())).toHaveLength(
        1,
      );
    });

    it('004 US5-2 answers suspended on AccountSuspended, keeping every row and pending change', async () => {
      await unitOfWork.run((repos) =>
        repos.lists.add({ id: 'l-1' as ListId, name: 'Locale' }),
      );
      handler = () => err({ type: 'AccountSuspended' });
      const before = await state();

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'suspended' });
      expect(await pendingCount()).toBe(1);
      expect(await state()).toEqual(before);
      expect(await credentials.read()).toBe('secret-credential');
    });

    it('004 US5-3 syncs again with no sign-in once the account is reactivated, sending what was queued', async () => {
      await unitOfWork.run((repos) =>
        repos.lists.add({ id: 'l-1' as ListId, name: 'Locale' }),
      );
      handler = () => err({ type: 'AccountSuspended' });
      await synchronize();
      handler = (request) => ok(respond(request));

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'saved' });
      expect(await pendingCount()).toBe(0);
    });

    it('004 US6-5 a suspended account then deleted ends as signedOut(accountDeleted)', async () => {
      handler = () => err({ type: 'AccountSuspended' });
      expect((await synchronize()).outcome).toEqual({ type: 'suspended' });
      handler = () => err({ type: 'AccountDeleted' });

      expect((await synchronize()).outcome).toEqual({
        type: 'signedOut',
        reason: 'accountDeleted',
      });
    });

    it('answers updateRequired on UpdateRequired', async () => {
      handler = () => err({ type: 'UpdateRequired' });

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'updateRequired' });
      expect(await pendingCount()).toBe(1);
    });

    it('answers failed on ServerError, keeping the entries', async () => {
      handler = () => err({ type: 'ServerError' });

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'failed', reason: 'ServerError' });
      expect(await pendingCount()).toBe(1);
    });

    it('answers failed on UntrustedServer, keeping the entries', async () => {
      handler = () => err({ type: 'UntrustedServer' });

      const result = await synchronize();

      expect(result.outcome).toEqual({
        type: 'failed',
        reason: 'UntrustedServer',
      });
      expect(await pendingCount()).toBe(1);
    });
  });
});
