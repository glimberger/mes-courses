import { minHlc, type Hlc } from '@mes-courses/sync-core';

/** The single row of `sync_state` (data-model.md, "Sync state"). The credential is not here. */
export type SyncState = {
  serverUrl: string | null;
  serverId: string | null;
  deviceId: string | null;
  /** Highest server `seq` applied locally; 0 before the first sync. */
  lastSeq: number;
  /** The device's HLC state; never moves backwards. */
  maxHlc: Hlc;
  lastSyncAt: string | null;
  /** False until the first full upload to this server completed (research R13). */
  snapshotDone: boolean;
};

export interface SyncStateRepository {
  /** The defaults (`lastSeq = 0`, `snapshotDone = false`, nothing connected) before any save. */
  get(): Promise<SyncState>;
  save(state: SyncState): Promise<void>;
}

/**
 * The device id of the stamps made before the device has paired: the server assigns the real one at
 * pairing. The first sync re-stamps the snapshot with it (research R13).
 */
export const LOCAL_DEVICE_ID = 'local';

/**
 * The device id of a seed's stamp. It sorts before any device id the server issues (UUIDs start
 * with a digit or a letter), so on a tie another device's snapshot value still wins (research R13).
 */
export const SEED_DEVICE_ID = '!';

/** What `get` returns before any save. */
export const initialSyncState = (): SyncState => ({
  serverUrl: null,
  serverId: null,
  deviceId: null,
  lastSeq: 0,
  maxHlc: minHlc(LOCAL_DEVICE_ID),
  lastSyncAt: null,
  snapshotDone: false,
});
