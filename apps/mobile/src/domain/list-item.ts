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
