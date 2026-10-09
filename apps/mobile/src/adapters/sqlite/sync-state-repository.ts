import { decodeHlc, encodeHlc } from '@mes-courses/sync-core';
import {
  initialSyncState,
  type SyncStateRepository,
} from '../../application/ports/sync-state';
import { findFirst, write } from './queries';
import type { SqlDatabase } from './sql-database';

type SyncStateRow = {
  server_url: string | null;
  server_id: string | null;
  device_id: string | null;
  last_seq: number;
  max_hlc: string;
  last_sync_at: string | null;
  snapshot_done: number;
};

/** The single `sync_state` row (id 1); without it, the defaults. */
export const sqliteSyncStateRepository = (
  db: SqlDatabase,
): SyncStateRepository => ({
  get: async () =>
    (await findFirst(
      db,
      `SELECT server_url, server_id, device_id, last_seq, max_hlc, last_sync_at, snapshot_done
       FROM sync_state WHERE id = 1`,
      [],
      (row: SyncStateRow) => ({
        serverUrl: row.server_url,
        serverId: row.server_id,
        deviceId: row.device_id,
        lastSeq: row.last_seq,
        maxHlc: decodeHlc(row.max_hlc),
        lastSyncAt: row.last_sync_at,
        snapshotDone: row.snapshot_done === 1,
      }),
    )) ?? initialSyncState(),
  save: (state) =>
    write(
      db,
      `INSERT INTO sync_state
         (id, server_url, server_id, device_id, last_seq, max_hlc, last_sync_at, snapshot_done)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         server_url = excluded.server_url,
         server_id = excluded.server_id,
         device_id = excluded.device_id,
         last_seq = excluded.last_seq,
         max_hlc = excluded.max_hlc,
         last_sync_at = excluded.last_sync_at,
         snapshot_done = excluded.snapshot_done`,
      [
        state.serverUrl,
        state.serverId,
        state.deviceId,
        state.lastSeq,
        encodeHlc(state.maxHlc),
        state.lastSyncAt,
        state.snapshotDone ? 1 : 0,
      ],
    ),
});
