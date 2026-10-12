import type { IdGenerator } from '../../application/ports/id-generator';
import type { LocalDataEraser } from '../../application/ports/local-data-eraser';
import type { UnitOfWork } from '../../application/ports/unit-of-work';
import {
  seedStore,
  type Seed,
} from '../../application/use-cases/initialize-store';
import type { SqlDatabase } from './sql-database';
import { withStorageErrors } from './storage-error';

/** Children first: `list_item` and `app_state` reference lists and articles. */
const TABLES = [
  'list_item',
  'app_state',
  'article',
  'shopping_list',
  'category',
  'pending_change',
  'sync_state',
] as const;

/**
 * Erases through the unit of work, so it waits for the runs ahead of it and happens inside one
 * transaction with the seed: a failure in the middle leaves everything as it was.
 */
export const sqliteLocalDataEraser = ({
  db,
  unitOfWork,
  ids,
  seed,
}: {
  db: SqlDatabase;
  unitOfWork: UnitOfWork;
  ids: IdGenerator;
  seed: Seed;
}): LocalDataEraser => ({
  erase: () =>
    unitOfWork.run(async (repos) => {
      // Same connection, so inside the transaction the run opened.
      await withStorageErrors(async () => {
        for (const table of TABLES)
          await db.runAsync(`DELETE FROM ${table}`, []);
      });
      await seedStore(repos, ids, seed);
    }),
});
