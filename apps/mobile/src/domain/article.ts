import type { CategoryId } from './category';

export type ArticleId = string & { readonly __brand: 'ArticleId' };

/** A catalog entry. It carries no quantity: a quantity belongs to a list item (FR-013). */
export type Article = {
  id: ArticleId;
  name: string;
  categoryId: CategoryId;
};

/** No article has this id (a missing record, never the user's input). */
export type ArticleNotFound = { type: 'ArticleNotFound' };
