import type { ArticleId } from './article';
import type { CategoryId } from './category';
import type { Quantity } from './quantity';
import type { ListId } from './shopping-list';

/** What the current list screen shows (data model, read models). */
export type CurrentListView = {
  list: { id: ListId; name: string };
  /** Items not in the cart (FR-006). */
  remainingCount: number;
  totalCount: number;
  /** Shows "Terminer les courses" (FR-007). */
  hasItemsInCart: boolean;
  /** Only categories holding an item of the list, ordered by position (FR-003, US4-5). */
  sections: {
    category: { id: CategoryId; name: string };
    items: {
      articleId: ArticleId;
      name: string;
      inCart: boolean;
      quantity: Quantity | null;
    }[];
  }[];
};
