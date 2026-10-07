import type { Article, ArticleId } from '../../../domain/article';
import type { Category, CategoryId } from '../../../domain/category';
import type { ListItem } from '../../../domain/list-item';
import type { ListId, ShoppingList } from '../../../domain/shopping-list';

/** Entity builders for the contract suites, so each test states only what it is about. */
export const category = (
  id: string,
  name: string,
  position: number,
): Category => ({
  id: id as CategoryId,
  name,
  position,
});

export const article = (
  id: string,
  name: string,
  categoryId: string,
): Article => ({
  id: id as ArticleId,
  name,
  categoryId: categoryId as CategoryId,
});

export const list = (id: string, name: string): ShoppingList => ({
  id: id as ListId,
  name,
});

export const item = (
  listId: string,
  articleId: string,
  changes: Partial<Pick<ListItem, 'inCart' | 'quantity'>> = {},
): ListItem => ({
  listId: listId as ListId,
  articleId: articleId as ArticleId,
  inCart: false,
  quantity: null,
  ...changes,
});

export const listId = (id: string) => id as ListId;
export const articleId = (id: string) => id as ArticleId;
export const categoryId = (id: string) => id as CategoryId;
