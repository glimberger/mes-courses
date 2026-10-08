import type { Article, ArticleId } from '../../../domain/article';
import { filterCatalog, type CatalogView } from '../../../domain/catalog-view';
import type { CategoryId } from '../../../domain/category';
import type { AlreadyOnList, ItemNotOnList } from '../../../domain/list-item';
import {
  cleanName,
  type NameAlreadyUsed,
  type NameError,
} from '../../../domain/name';
import type { Quantity } from '../../../domain/quantity';
import { ok, type Result } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import { shownList, type CurrentListActions } from './current-list-actions';
import type { ScreenState } from './screen-state';
import type {
  StoreCore,
  StoreKit,
  WriteFailed,
  WriteOptions,
} from './store-kit';

/** The actions of the add and create screens and of the list's rows (User Story 2). */
export type EditListActions = {
  /** Reads the whole catalog of the current list once; also used by "Réessayer" (R11a). */
  loadCatalog: () => Promise<void>;
  /** Filters the loaded catalog at once, reading nothing (SC-011, R11a). */
  searchCatalog: (query: string) => void;
  /** Loads the categories for the category picker; also used by "Réessayer". */
  loadCategories: () => Promise<void>;
  /** Adds the article to the current list, and confirms it with its name (US2-1). */
  addArticleToList: (
    article: { id: ArticleId; name: string },
    quantity: Quantity | null,
  ) => Promise<Result<void, AlreadyOnList | WriteFailed>>;
  /** Creates the article and adds it to the current list, and confirms it (US2-7). */
  createArticleAndAddToList: (
    article: { name: string; categoryId: CategoryId },
    quantity: Quantity | null,
  ) => Promise<
    Result<
      { articleId: ArticleId },
      NameError | NameAlreadyUsed<Article> | WriteFailed
    >
  >;
  changeItemQuantity: (
    articleId: ArticleId,
    quantity: Quantity | null,
  ) => Promise<Result<void, WriteFailed>>;
  /**
   * Removes the item from the current list and offers to undo it (US2-6, FR-010). An item
   * already gone, removed by a tap just before, is left as it is: `ItemNotOnList`, not reported.
   */
  removeItem: (
    articleId: ArticleId,
  ) => Promise<Result<void, ItemNotOnList | WriteFailed>>;
  /** Ends the offer at once, then puts the item back in the write queue (R8). */
  undo: () => Promise<void>;
  /** Ends the offer: the removal is final (FR-010). */
  dismissUndo: () => void;
};

type CatalogState = StoreCore['catalog'];

/** The full catalog as the query shows it: no match is the empty state (US2-14). */
const viewOf = (
  full: CatalogState['full'],
  query: string,
): CatalogState['view'] => {
  if (full.status !== 'success') return full;
  const data = filterCatalog(full.data, query);
  const cleaned = cleanName(query);
  return cleaned !== '' && data.sections.length === 0
    ? { status: 'empty', detail: { query: cleaned } }
    : { status: 'success', data };
};

/** The current list cannot be read; loading it reported why. */
class NoCurrentList extends Error {
  constructor() {
    super('No current list shown');
    this.name = 'NoCurrentList';
  }
}

export const createEditListActions = (
  { get, set, useCases, runWrite, region, reloadOnRefresh, report }: StoreKit,
  { loadCurrentList }: Pick<CurrentListActions, 'loadCurrentList'>,
): EditListActions => {
  /** The list the current list region shows, loaded first when it shows none. */
  const currentListId = async (): Promise<ListId> => {
    if (shownList(get().currentList) === null) await loadCurrentList();
    const list = shownList(get().currentList);
    if (list === null) throw new NoCurrentList();
    return list.id;
  };

  /**
   * Runs a write on the current list. With the list shown, the write joins the queue at once,
   * so it keeps its place among the taps made around it (FR-004).
   */
  const writeOnList = <
    T,
    E extends { type: string },
    X extends E['type'] = never,
  >(
    operation: string,
    call: (listId: ListId) => Promise<Result<T, E>>,
    options?: WriteOptions<T, X>,
  ) => {
    const shown = shownList(get().currentList);
    return runWrite<T, E, X>(
      operation,
      async () => call(shown?.id ?? (await currentListId())),
      options,
    );
  };

  const setCatalog = (full: CatalogState['full']) => {
    const { query } = get().catalog;
    set({ catalog: { query, full, view: viewOf(full, query) } });
  };

  let latestCatalog = 0;
  const loadCatalog = async () => {
    const started = ++latestCatalog;
    // A reload keeps the catalog on screen until the new one arrives.
    if (get().catalog.full.status !== 'success') {
      setCatalog({ status: 'loading' });
    }
    let loaded: ScreenState<CatalogView>;
    try {
      loaded = {
        status: 'success',
        data: await useCases.getCatalog(await currentListId()),
      };
    } catch (error) {
      loaded = { status: 'error', error };
      // Loading the current list already reported its own failure.
      if (!(error instanceof NoCurrentList)) report(error, 'getCatalog');
    }
    if (started === latestCatalog) setCatalog(loaded);
  };
  reloadOnRefresh(() => get().catalog.full.status !== 'idle', loadCatalog);

  const searchCatalog = (query: string) => {
    const { full } = get().catalog;
    set({ catalog: { query, full, view: viewOf(full, query) } });
  };

  const loadCategories = region('categories', 'getCategories', async () => ({
    status: 'success',
    data: await useCases.getCategories(),
  }));

  const confirmAdded = (name: string) =>
    set({ notice: { type: 'articleAdded', name } });

  const addArticleToList: EditListActions['addArticleToList'] = async (
    article,
    quantity,
  ) => {
    const outcome = await writeOnList(
      'addArticleToList',
      (listId) => useCases.addArticleToList(listId, article.id, quantity),
      { expected: ['AlreadyOnList'] },
    );
    if (outcome.ok) confirmAdded(article.name);
    return outcome;
  };

  const createArticleAndAddToList: EditListActions['createArticleAndAddToList'] =
    async (article, quantity) => {
      const outcome = await writeOnList('createArticleAndAddToList', (listId) =>
        useCases.createArticleAndAddToList(listId, article, quantity),
      );
      if (outcome.ok) confirmAdded(cleanName(article.name));
      return outcome;
    };

  const changeItemQuantity: EditListActions['changeItemQuantity'] = (
    articleId,
    quantity,
  ) =>
    writeOnList('changeItemQuantity', (listId) =>
      useCases.changeItemQuantity(listId, articleId, quantity),
    );

  /** The name the current list shows for the item. */
  const shownName = (articleId: ArticleId): string => {
    const region = get().currentList;
    if (region.status !== 'success') return '';
    for (const section of region.data.sections) {
      const item = section.items.find((i) => i.articleId === articleId);
      if (item) return item.name;
    }
    return '';
  };

  const removeItem: EditListActions['removeItem'] = async (articleId) => {
    const name = shownName(articleId);
    const outcome = await writeOnList(
      'removeItemFromList',
      (listId) => useCases.removeItemFromList(listId, articleId),
      {
        expected: ['ItemNotOnList'],
        offer: (removed) => ({ kind: 'removedItem', removed, name }),
      },
    );
    return outcome.ok ? ok(undefined) : outcome;
  };

  const undo = async () => {
    const offer = get().pendingUndo;
    if (offer === null) return;
    set({ pendingUndo: null });
    if (offer.kind === 'deletedArticle') {
      await runWrite('restoreDeletedArticle', () =>
        useCases.restoreDeletedArticle(offer.deleted),
      );
      return;
    }
    await runWrite('restoreRemovedItem', () =>
      useCases.restoreRemovedItem(offer.removed),
    );
  };

  return {
    loadCatalog,
    searchCatalog,
    loadCategories,
    addArticleToList,
    createArticleAndAddToList,
    changeItemQuantity,
    removeItem,
    undo,
    dismissUndo: () => set({ pendingUndo: null }),
  };
};
