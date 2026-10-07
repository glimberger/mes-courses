import type { CategoryRepository } from '../../application/ports/repositories';
import type { Category, CategoryId } from '../../domain/category';
import { normalizedName } from '../../domain/name';
import type { SqlDatabase } from './sql-database';
import { withStorageErrors } from './storage-error';

type CategoryRow = { id: string; name: string; position: number };

const COLUMNS = 'SELECT id, name, position FROM category';

const toCategory = (row: CategoryRow): Category => ({
  id: row.id as CategoryId,
  name: row.name,
  position: row.position,
});

export const sqliteCategoryRepository = (
  db: SqlDatabase,
): CategoryRepository => {
  const findOne = (where: string, value: string) =>
    withStorageErrors(async () => {
      const row = await db.getFirstAsync<CategoryRow>(
        `${COLUMNS} WHERE ${where} = ?`,
        [value],
      );
      return row && toCategory(row);
    });

  return {
    all: () =>
      withStorageErrors(async () =>
        (
          await db.getAllAsync<CategoryRow>(`${COLUMNS} ORDER BY position`, [])
        ).map(toCategory),
      ),
    findById: (id) => findOne('id', id),
    findByNormalizedName: (normalized) =>
      findOne('normalized_name', normalized),
    nextPosition: () =>
      withStorageErrors(async () => {
        const row = await db.getFirstAsync<{ next: number }>(
          'SELECT coalesce(max(position) + 1, 0) AS next FROM category',
          [],
        );
        return row?.next ?? 0;
      }),
    add: (category) =>
      withStorageErrors(async () => {
        await db.runAsync(
          'INSERT INTO category (id, name, normalized_name, position) VALUES (?, ?, ?, ?)',
          [
            category.id,
            category.name,
            normalizedName(category.name),
            category.position,
          ],
        );
      }),
  };
};
