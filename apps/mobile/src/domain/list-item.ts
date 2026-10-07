import type { ArticleId } from './article';
import type { Quantity } from './quantity';
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

/** Puts the item in the cart, or takes it out (FR-004). */
export const toggle = (item: ListItem): ListItem => ({
  ...item,
  inCart: !item.inCart,
});

/** Takes every item out of the cart, keeping the items and their quantities (FR-007). */
export const finish = (items: readonly ListItem[]): ListItem[] =>
  items.map((item) => ({ ...item, inCart: false }));
