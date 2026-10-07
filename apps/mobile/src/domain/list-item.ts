import type { ArticleId } from './article';
import type { Quantity } from './quantity';
import { err, ok, type Result } from './result';
import type { ListId } from './shopping-list';

/** An article on a list, identified by the pair (`listId`, `articleId`) (FR-011). */
export type ListItem = {
  listId: ListId;
  articleId: ArticleId;
  inCart: boolean;
  quantity: Quantity | null;
};

/** A removed item as it was, so "Annuler" can put it back (FR-010). */
export type RemovedItem = {
  listId: ListId;
  articleId: ArticleId;
  inCart: boolean;
  quantity: Quantity | null;
};

/** The list does not hold the article (a missing record, never the user's input). */
export type ItemNotOnList = { type: 'ItemNotOnList' };

/**
 * The list already holds the article (FR-011). It carries the item's quantity, so the user can
 * be offered to change it (US2-8).
 */
export type AlreadyOnList = {
  type: 'AlreadyOnList';
  quantity: Quantity | null;
};

/**
 * Puts the article on the list, unticked, with the quantity or none (FR-012, FR-013, FR-014),
 * unless the list already holds it (`onList`, the item stored for this list and article).
 */
export const add = (
  onList: ListItem | null,
  { listId, articleId }: { listId: ListId; articleId: ArticleId },
  quantity: Quantity | null,
): Result<ListItem, AlreadyOnList> =>
  onList
    ? err({ type: 'AlreadyOnList', quantity: onList.quantity })
    : ok({ listId, articleId, inCart: false, quantity });

/** Sets or clears the quantity of this item only, keeping its tick (FR-015). */
export const changeQuantity = (
  item: ListItem,
  quantity: Quantity | null,
): ListItem => ({ ...item, quantity });

/** Puts the item in the cart, or takes it out (FR-004). */
export const toggle = (item: ListItem): ListItem => ({
  ...item,
  inCart: !item.inCart,
});
