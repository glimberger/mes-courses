import type { Article, ArticleId } from './article';
import type { Category, CategoryId } from './category';
import type { ListItem } from './list-item';
import { compareNames } from './name';
import type { Quantity } from './quantity';
import type { ListId, ShoppingList } from './shopping-list';

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

type Section = CurrentListView['sections'][number];
type Row = Section['items'][number];

/** Unticked items first, then ticked ones, each group by name (FR-005). */
const compareRows = (a: Row, b: Row): number =>
  Number(a.inCart) - Number(b.inCart) || compareNames(a.name, b.name);

/** Rebuilds the counts and the order of the rows from the sections' items. */
export const summarizeSections = (
  list: CurrentListView['list'],
  sections: Section[],
): CurrentListView => {
  const rows = sections.flatMap((section) => section.items);
  const remainingCount = rows.filter((row) => !row.inCart).length;
  return {
    list,
    remainingCount,
    totalCount: rows.length,
    hasItemsInCart: remainingCount < rows.length,
    sections: sections.map((section) => ({
      category: section.category,
      items: [...section.items].sort(compareRows),
    })),
  };
};

/**
 * The current list as the screen shows it: one section per category holding an item, ordered
 * by position (FR-003, US4-5), unticked items before ticked ones (FR-005), and the counts.
 */
export const buildCurrentListView = ({
  list,
  categories,
  articles,
  items,
}: {
  list: ShoppingList;
  categories: readonly Category[];
  articles: readonly Article[];
  items: readonly ListItem[];
}): CurrentListView => {
  const articlesById = new Map(
    articles.map((article) => [article.id, article]),
  );
  const rowsByCategory = new Map<CategoryId, Row[]>();
  for (const item of items) {
    const article = articlesById.get(item.articleId);
    if (!article) continue;
    const rows = rowsByCategory.get(article.categoryId) ?? [];
    rows.push({
      articleId: item.articleId,
      name: article.name,
      inCart: item.inCart,
      quantity: item.quantity,
    });
    rowsByCategory.set(article.categoryId, rows);
  }
  const sections = [...categories]
    .sort((a, b) => a.position - b.position)
    .flatMap((category) => {
      const rows = rowsByCategory.get(category.id);
      return rows
        ? [{ category: { id: category.id, name: category.name }, items: rows }]
        : [];
    });
  return summarizeSections({ id: list.id, name: list.name }, sections);
};
