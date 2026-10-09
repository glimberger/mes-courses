import { minHlc } from '@mes-courses/sync-core';
import type { Repositories } from '../../ports/unit-of-work';
import type { SyncState } from '../../ports/sync-state';

export const syncStateRepositoryContract = (
  createRepositories: () => Promise<Repositories>,
) => {
  describe('SyncStateRepository contract', () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await createRepositories();
    });

    const connected = (overrides: Partial<SyncState> = {}): SyncState => ({
      serverUrl: 'https://courses.example.org',
      serverId: 'server-1',
      deviceId: 'device-1',
      lastSeq: 42,
      maxHlc: { wallMs: 9_000, counter: 3, deviceId: 'device-1' },
      lastSyncAt: '2026-10-10T08:00:00.000Z',
      snapshotDone: true,
      ...overrides,
    });

    it('starts with nothing connected, lastSeq = 0 and snapshotDone = false', async () => {
      const state = await repos.syncState.get();

      expect(state).toMatchObject({
        serverUrl: null,
        serverId: null,
        deviceId: null,
        lastSeq: 0,
        lastSyncAt: null,
        snapshotDone: false,
      });
      expect(state.maxHlc.wallMs).toBe(minHlc('').wallMs);
      expect(state.maxHlc.counter).toBe(0);
    });

    it('gives back what was saved', async () => {
      await repos.syncState.save(connected());

      expect(await repos.syncState.get()).toEqual(connected());
    });

    it('replaces the previous state, keeping a single row', async () => {
      await repos.syncState.save(connected());
      await repos.syncState.save(
        connected({ serverUrl: null, serverId: null, deviceId: null }),
      );

      expect(await repos.syncState.get()).toEqual(
        connected({ serverUrl: null, serverId: null, deviceId: null }),
      );
    });

    it('keeps copies: changing a returned state changes nothing stored', async () => {
      await repos.syncState.save(connected());

      const found = await repos.syncState.get();
      found.lastSeq = 0;
      found.maxHlc.counter = 99;

      expect(await repos.syncState.get()).toEqual(connected());
    });
  });
};
