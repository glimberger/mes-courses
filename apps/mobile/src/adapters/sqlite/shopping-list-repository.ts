import type { ShoppingListRepository } from '../../application/ports/repositories';
import { normalizedName } from '../../domain/name';
import type { ListId, ShoppingList } from '../../domain/shopping-list';
import { findAll, findFirst, write } from './queries';
import type { SqlDatabase } from './sql-database';

type ListRow = { id: string; name: string };

const SELECT = 'SELECT id, name FROM shopping_list';

const toList = (row: ListRow): ShoppingList => ({
  id: row.id as ListId,
  name: row.name,
});

export const sqliteShoppingListRepository = (
  db: SqlDatabase,
): ShoppingListRepository => ({
  // The rowid grows with each insert: the order they were added.
  all: () => findAll(db, `${SELECT} ORDER BY rowid`, [], toList),
  findById: (id) => findFirst(db, `${SELECT} WHERE id = ?`, [id], toList),
  findByNormalizedName: (normalized) =>
    findFirst(db, `${SELECT} WHERE normalized_name = ?`, [normalized], toList),
  count: async () =>
    (await findFirst(
      db,
      'SELECT count(*) AS count FROM shopping_list',
      [],
      (row: { count: number }) => row.count,
    )) ?? 0,
  add: (list) =>
    write(
      db,
      'INSERT INTO shopping_list (id, name, normalized_name) VALUES (?, ?, ?)',
      [list.id, list.name, normalizedName(list.name)],
    ),
  itemCounts: async () =>
    new Map(
      await findAll(
        db,
        `SELECT shopping_list.id AS id, count(list_item.article_id) AS count
         FROM shopping_list LEFT JOIN list_item ON list_item.list_id = shopping_list.id
         GROUP BY shopping_list.id`,
        [],
        (row: { id: string; count: number }) =>
          [row.id as ListId, row.count] as const,
      ),
    ),
});
