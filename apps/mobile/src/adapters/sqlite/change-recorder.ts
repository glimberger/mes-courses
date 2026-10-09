import {
  decodeHlc,
  encodeHlc,
  nextHlc,
  type Change,
  type EntityKind,
} from '@mes-courses/sync-core';
import type { ChangeRecorder } from '../../application/ports/change-recorder';
import type { Clock } from '../../application/ports/clock';
import type { IdGenerator } from '../../application/ports/id-generator';
import { LOCAL_DEVICE_ID } from '../../application/ports/sync-state';
import { findAll, findFirst, write } from './queries';
import type { SqlDatabase } from './sql-database';
import { sqliteSyncStateRepository } from './sync-state-repository';

type PendingRow = {
  seq: number;
  change_id: string;
  hlc: string;
  kind: string;
  entity_id: string;
  fields: string;
};

const toPending = (row: PendingRow) =>
  ({
    seq: row.seq,
    changeId: row.change_id,
    hlc: decodeHlc(row.hlc),
    kind: row.kind as EntityKind,
    id: row.entity_id,
    fields: JSON.parse(row.fields) as object,
  }) as Change & { seq: number };

/**
 * The outbox, on `pending_change`. Each stamp follows the device's `max_hlc`, which is saved in the
 * same transaction, so a rolled back write moves neither.
 */
export const sqliteChangeRecorder = (
  db: SqlDatabase,
  clock: Clock,
  ids: IdGenerator,
): ChangeRecorder => {
  const syncState = sqliteSyncStateRepository(db);
  return {
    record: async (kind, id, fields, options) => {
      const state = await syncState.get();
      const hlc = nextHlc(
        { ...state.maxHlc, deviceId: state.deviceId ?? LOCAL_DEVICE_ID },
        clock.nowMs(),
      );
      await write(
        db,
        `INSERT INTO pending_change (change_id, hlc, kind, entity_id, fields, held_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ids.next(),
          encodeHlc(hlc),
          kind,
          id,
          JSON.stringify(fields),
          options?.heldBy ?? null,
        ],
      );
      await syncState.save({ ...state, maxHlc: hlc });
    },
    pending: (limit) =>
      findAll(
        db,
        `SELECT seq, change_id, hlc, kind, entity_id, fields FROM pending_change
         WHERE held_by IS NULL ORDER BY seq LIMIT ?`,
        [limit],
        toPending,
      ),
    acknowledge: async (changeIds) => {
      for (const changeId of changeIds) {
        await write(db, 'DELETE FROM pending_change WHERE change_id = ?', [
          changeId,
        ]);
      }
    },
    release: (heldBy) =>
      write(db, 'UPDATE pending_change SET held_by = NULL WHERE held_by = ?', [
        heldBy,
      ]),
    releaseAll: () => write(db, 'UPDATE pending_change SET held_by = NULL', []),
    discard: (heldBy) =>
      write(db, 'DELETE FROM pending_change WHERE held_by = ?', [heldBy]),
    count: async () =>
      (await findFirst(
        db,
        'SELECT count(*) AS total FROM pending_change WHERE held_by IS NULL',
        [],
        (row: { total: number }) => row.total,
      )) ?? 0,
  };
};
