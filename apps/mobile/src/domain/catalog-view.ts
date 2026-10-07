import type { ArticleId } from './article';
import type { CategoryId } from './category';
import type { Quantity } from './quantity';

/** The catalog shown by the add screen, for one target list (data model, read models). */
export type CatalogView = {
  sections: {
    category: { id: CategoryId; name: string };
    articles: {
      id: ArticleId;
      name: string;
      /** `searchForm(name)`, computed once per view (R11a). */
      searchText: string;
      /** Already on the target list (FR-011, US2-8). */
      onList: boolean;
      /** The quantity on the target list. */
      quantity: Quantity | null;
    }[];
  }[];
};
