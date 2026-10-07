import type { Article, ArticleId } from './article';
import type { Category, CategoryId } from './category';
import type { ListItem } from './list-item';
import { cleanName, compareNames, searchForm } from './name';
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

/**
 * The whole catalog, unfiltered: every category ordered by position, empty ones included
 * (US2-15), its articles sorted by name, each marked when it is on the target list, whose items
 * are given (FR-011). Each article carries its search form, so filtering never computes it again
 * (R11a).
 */
export const buildCatalogView = ({
  categories,
  articles,
  items,
}: {
  categories: readonly Category[];
  articles: readonly Article[];
  /** The items of the target list. */
  items: readonly ListItem[];
}): CatalogView => {
  const itemsByArticle = new Map(items.map((item) => [item.articleId, item]));
  const articlesByCategory = new Map<CategoryId, Article[]>();
  for (const article of articles) {
    const inCategory = articlesByCategory.get(article.categoryId) ?? [];
    inCategory.push(article);
    articlesByCategory.set(article.categoryId, inCategory);
  }
  return {
    sections: [...categories]
      .sort((a, b) => a.position - b.position)
      .map((category) => ({
        category: { id: category.id, name: category.name },
        articles: (articlesByCategory.get(category.id) ?? [])
          .sort((a, b) => compareNames(a.name, b.name))
          .map((article) => {
            const item = itemsByArticle.get(article.id);
            return {
              id: article.id,
              name: article.name,
              searchText: searchForm(article.name),
              onList: item !== undefined,
              quantity: item?.quantity ?? null,
            };
          }),
      })),
  };
};

/**
 * The view's articles whose search form contains the query's, in the view's order, without the
 * categories left empty (FR-009, US2-10, US2-14). A query blank once cleaned is no query: the
 * view is returned whole, empty categories included.
 */
export const filterCatalog = (
  view: CatalogView,
  query: string,
): CatalogView => {
  if (cleanName(query) === '') return view;
  const wanted = searchForm(query);
  return {
    sections: view.sections.flatMap((section) => {
      const articles = section.articles.filter((article) =>
        article.searchText.includes(wanted),
      );
      return articles.length > 0
        ? [{ category: section.category, articles }]
        : [];
    }),
  };
};
