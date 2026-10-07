import type { ListItemRepository } from '../../application/ports/repositories';
import type { ArticleId } from '../../domain/article';
import type { ListItem } from '../../domain/list-item';
import type { ListId } from '../../domain/shopping-list';
import { findAll, findFirst, write } from './queries';
import type { SqlDatabase } from './sql-database';

type ItemRow = {
  list_id: string;
  article_id: string;
  in_cart: number;
  quantity_amount: number | null;
  quantity_unit: string | null;
};

const SELECT =
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
  // The rowid grows with each insert and an upsert keeps it: the order they were added.
  forList: (listId) =>
    findAll(db, `${SELECT} WHERE list_id = ? ORDER BY rowid`, [listId], toItem),
  find: (listId, articleId) =>
    findFirst(
      db,
      `${SELECT} WHERE list_id = ? AND article_id = ?`,
      [listId, articleId],
      toItem,
    ),
  save: (item) =>
    write(
      db,
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
    ),
  remove: (listId, articleId) =>
    write(db, 'DELETE FROM list_item WHERE list_id = ? AND article_id = ?', [
      listId,
      articleId,
    ]),
  takeAllOutOfCart: (listId) =>
    write(db, 'UPDATE list_item SET in_cart = 0 WHERE list_id = ?', [listId]),
});
