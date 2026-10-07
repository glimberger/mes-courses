import type { ListItemRepository } from '../../application/ports/repositories';
import type { ArticleId } from '../../domain/article';
import type { ListItem } from '../../domain/list-item';
import type { ListId } from '../../domain/shopping-list';
import type { SqlDatabase } from './sql-database';
import { withStorageErrors } from './storage-error';

type ItemRow = {
  list_id: string;
  article_id: string;
  in_cart: number;
  quantity_amount: number | null;
  quantity_unit: string | null;
};

const COLUMNS =
  'SELECT list_id, article_id, in_cart, quantity_amount, quantity_unit FROM list_item';

const toItem = (row: ItemRow): ListItem => ({
  listId: row.list_id as ListId,
  articleId: row.article_id as ArticleId,
  inCart: row.in_cart === 1,
  quantity:
    row.quantity_amount === null
      ? null
      : { amount: row.quantity_amount, unit: row.quantity_unit },
});

export const sqliteListItemRepository = (
  db: SqlDatabase,
): ListItemRepository => ({
  forList: (listId) =>
    withStorageErrors(async () =>
      (
        await db.getAllAsync<ItemRow>(`${COLUMNS} WHERE list_id = ?`, [listId])
      ).map(toItem),
    ),
  find: (listId, articleId) =>
    withStorageErrors(async () => {
      const row = await db.getFirstAsync<ItemRow>(
        `${COLUMNS} WHERE list_id = ? AND article_id = ?`,
        [listId, articleId],
      );
      return row && toItem(row);
    }),
  save: (item) =>
    withStorageErrors(async () => {
      await db.runAsync(
        `INSERT INTO list_item (list_id, article_id, in_cart, quantity_amount, quantity_unit)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (list_id, article_id) DO UPDATE SET
           in_cart = excluded.in_cart,
           quantity_amount = excluded.quantity_amount,
           quantity_unit = excluded.quantity_unit`,
        [
          item.listId,
          item.articleId,
          item.inCart ? 1 : 0,
          item.quantity?.amount ?? null,
          item.quantity?.unit ?? null,
        ],
      );
    }),
  remove: (listId, articleId) =>
    withStorageErrors(async () => {
      await db.runAsync(
        'DELETE FROM list_item WHERE list_id = ? AND article_id = ?',
        [listId, articleId],
      );
    }),
  takeAllOutOfCart: (listId) =>
    withStorageErrors(async () => {
      await db.runAsync('UPDATE list_item SET in_cart = 0 WHERE list_id = ?', [
        listId,
      ]);
    }),
});
