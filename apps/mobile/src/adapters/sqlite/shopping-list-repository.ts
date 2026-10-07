import type { ShoppingListRepository } from '../../application/ports/repositories';
import { normalizedName } from '../../domain/name';
import type { ListId, ShoppingList } from '../../domain/shopping-list';
import type { SqlDatabase } from './sql-database';
import { withStorageErrors } from './storage-error';

type ListRow = { id: string; name: string };

const COLUMNS = 'SELECT id, name FROM shopping_list';

const toList = (row: ListRow): ShoppingList => ({
  id: row.id as ListId,
  name: row.name,
});

export const sqliteShoppingListRepository = (
  db: SqlDatabase,
): ShoppingListRepository => {
  const findOne = (where: string, value: string) =>
    withStorageErrors(async () => {
      const row = await db.getFirstAsync<ListRow>(
        `${COLUMNS} WHERE ${where} = ?`,
        [value],
      );
      return row && toList(row);
    });

  return {
    all: () =>
      withStorageErrors(async () =>
        (await db.getAllAsync<ListRow>(COLUMNS, [])).map(toList),
      ),
    findById: (id) => findOne('id', id),
    findByNormalizedName: (normalized) =>
      findOne('normalized_name', normalized),
    count: () =>
      withStorageErrors(async () => {
        const row = await db.getFirstAsync<{ count: number }>(
          'SELECT count(*) AS count FROM shopping_list',
          [],
        );
        return row?.count ?? 0;
      }),
    add: (list) =>
      withStorageErrors(async () => {
        await db.runAsync(
          'INSERT INTO shopping_list (id, name, normalized_name) VALUES (?, ?, ?)',
          [list.id, list.name, normalizedName(list.name)],
        );
      }),
    itemCounts: () =>
      withStorageErrors(async () => {
        const rows = await db.getAllAsync<{ id: string; count: number }>(
          `SELECT shopping_list.id AS id, count(list_item.article_id) AS count
           FROM shopping_list LEFT JOIN list_item ON list_item.list_id = shopping_list.id
           GROUP BY shopping_list.id`,
          [],
        );
        return new Map(rows.map((row) => [row.id as ListId, row.count]));
      }),
  };
};
