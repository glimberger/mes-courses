import type { CategoryId } from './category';
import type { Quantity } from './quantity';
import type { ListId } from './shopping-list';

export type ArticleId = string & { readonly __brand: 'ArticleId' };

/** A catalog entry. It carries no quantity: a quantity belongs to a list item (FR-013). */
export type Article = {
  id: ArticleId;
  name: string;
  categoryId: CategoryId;
};

/** No article has this id (a missing record, never the user's input). */
export type ArticleNotFound = { type: 'ArticleNotFound' };

/**
 * An article deleted, as it was with each list item that held it, so "Annuler" can bring it back
 * with the same id (FR-009, SC-006).
 */
export type DeletedArticle = {
  /** Names the held change of this deletion, kept back until the offer ends. */
  undoId: string;
  article: Article;
  items: { listId: ListId; inCart: boolean; quantity: Quantity | null }[];
};

/** Where an article is used: the lists holding it, sorted by name (FR-006). */
export type ArticleUsage = {
  article: { id: ArticleId; name: string };
  lists: { id: ListId; name: string }[];
};
