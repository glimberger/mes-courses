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
    createSynchronize({ unitOfWork, syncServer, credentials, clock, ids })();
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

    it('FR-018b answers disconnectedByServer, with no request, when the credential is gone', async () => {
      await connect();
      await credentials.clear();
      await record('list', 'l-1', { name: 'Ma liste' });
      const before = await state();

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'disconnectedByServer' });
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

    it('FR-018a answers disconnectedByServer on DeviceNotAuthorized, keeping every row and pending change', async () => {
      await unitOfWork.run((repos) =>
        repos.lists.add({ id: 'l-1' as ListId, name: 'Locale' }),
      );
      handler = () => err({ type: 'DeviceNotAuthorized' });

      const result = await synchronize();

      expect(result.outcome).toEqual({ type: 'disconnectedByServer' });
      expect(await pendingCount()).toBe(1);
      expect(await unitOfWork.run((repos) => repos.lists.all())).toHaveLength(
        1,
      );
    });

    it('FR-018a answers disconnectedByServer when the serverId is not the one paired with', async () => {
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

      expect(result.outcome).toEqual({ type: 'disconnectedByServer' });
      expect(apply).not.toHaveBeenCalled();
      expect(await pendingCount()).toBe(1);
      expect(await state()).toEqual(before);
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
