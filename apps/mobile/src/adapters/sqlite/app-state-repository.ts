import type { AppStateRepository } from '../../application/ports/repositories';
import type { ListId } from '../../domain/shopping-list';
import { findFirst, write } from './queries';
import type { SqlDatabase } from './sql-database';

/** The single `app_state` row (id 1) holds the current list (FR-002). */
export const sqliteAppStateRepository = (
  db: SqlDatabase,
): AppStateRepository => ({
  currentListId: () =>
    findFirst(
      db,
      'SELECT current_list_id FROM app_state WHERE id = 1',
      [],
      (row: { current_list_id: string }) => row.current_list_id as ListId,
    ),
  setCurrentListId: (id) =>
    write(
      db,
      `INSERT INTO app_state (id, current_list_id) VALUES (1, ?)
       ON CONFLICT (id) DO UPDATE SET current_list_id = excluded.current_list_id`,
      [id],
    ),
});
