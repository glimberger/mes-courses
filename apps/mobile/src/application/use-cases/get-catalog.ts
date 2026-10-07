import {
  buildCatalogView,
  filterCatalog,
  type CatalogView,
} from '../../domain/catalog-view';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * The catalog by category, marking the articles on the list, filtered by the query when one is
 * given (FR-008, FR-009, FR-011). The add screen reads it once with no query and filters it as
 * the user types (R11a).
 */
export const createGetCatalog =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  async (listId: ListId, query?: string): Promise<CatalogView> => {
    const view = await unitOfWork.run(async (repos) =>
      buildCatalogView({
        categories: await repos.categories.all(),
        articles: await repos.articles.all(),
        items: await repos.items.forList(listId),
      }),
    );
    return query === undefined ? view : filterCatalog(view, query);
  };
