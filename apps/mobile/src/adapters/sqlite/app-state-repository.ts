import type { AppStateRepository } from '../../application/ports/repositories';
import type { ListId } from '../../domain/shopping-list';
import type { SqlDatabase } from './sql-database';
import { withStorageErrors } from './storage-error';

/** The single `app_state` row (id 1) holds the current list (FR-002). */
export const sqliteAppStateRepository = (
  db: SqlDatabase,
): AppStateRepository => ({
  currentListId: () =>
    withStorageErrors(async () => {
      const row = await db.getFirstAsync<{ current_list_id: string }>(
        'SELECT current_list_id FROM app_state WHERE id = 1',
        [],
      );
      return row ? (row.current_list_id as ListId) : null;
    }),
  setCurrentListId: (id) =>
    withStorageErrors(async () => {
      await db.runAsync(
        `INSERT INTO app_state (id, current_list_id) VALUES (1, ?)
         ON CONFLICT (id) DO UPDATE SET current_list_id = excluded.current_list_id`,
        [id],
      );
    }),
});
