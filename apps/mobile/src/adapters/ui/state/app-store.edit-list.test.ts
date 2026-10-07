import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { CatalogView } from '../../../domain/catalog-view';
import type { CategoryId } from '../../../domain/category';
import type { CurrentListView } from '../../../domain/current-list-view';
import { err, ok } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import { buildStoryStore, type Fixture } from '../testing/story-store';
import type { UseCases } from '../use-cases';
import { createAppStore, type AppStore } from './app-store';

const maListe = 'list-ma-liste' as ListId;
const fruits = 'category-fruits' as CategoryId;
const cremerie = 'category-cremerie' as CategoryId;
const boissons = 'category-boissons' as CategoryId;
const lait = { id: 'article-lait' as ArticleId, name: 'Lait' };
const beurre = { id: 'article-beurre' as ArticleId, name: 'Beurre' };
const pommes = { id: 'article-pommes' as ArticleId, name: 'Pommes' };
const pommesDeTerre = {
  id: 'article-pommes-de-terre' as ArticleId,
  name: 'Pommes de terre',
};

/** "Ma liste" holds "Lait" (2 L) and "Beurre" (ticked, 2 kg); "Boissons" is empty. */
const seed: Fixture = {
  categories: [
    { id: fruits, name: 'Fruits et légumes', position: 0 },
    { id: cremerie, name: 'Crèmerie', position: 1 },
    { id: boissons, name: 'Boissons', position: 2 },
  ],
  articles: [
    { ...lait, categoryId: cremerie },
    { ...beurre, categoryId: cremerie },
    { ...pommes, categoryId: fruits },
    { ...pommesDeTerre, categoryId: fruits },
  ],
  lists: [{ id: maListe, name: 'Ma liste' }],
  items: [
    {
      listId: maListe,
      articleId: lait.id,
      inCart: false,
      quantity: { amount: 2, unit: 'L' },
    },
    {
      listId: maListe,
      articleId: beurre.id,
      inCart: true,
      quantity: { amount: 2, unit: 'kg' },
    },
  ],
  currentListId: maListe,
};

const deferred = () => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { released, release };
};

/** Lets every queued promise run: the fakes and the store only chain promises. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A store on the real use cases over in-memory fakes holding `seed`, except those the test
 * replaces; `getCatalog` is a jest mock calling the real one, unless replaced.
 */
const buildStore = async (
  replace: (real: UseCases) => Partial<UseCases> = () => ({}),
) => {
  const built = await buildStoryStore({ seed });
  const getCatalog = jest.fn(built.useCases.getCatalog);
  const useCases: UseCases = {
    ...built.useCases,
    getCatalog,
    ...replace(built.useCases),
  };
  const errorReporter = new RecordingErrorReporter();
  const store = createAppStore({ useCases, errorReporter });
  const stored = (articleId: ArticleId) =>
    built.unitOfWork.run((repos) => repos.items.find(maListe, articleId));
  return {
    store,
    errorReporter,
    getCatalog,
    stored,
    unitOfWork: built.unitOfWork,
    useCases,
  };
};

const fullCatalog = (store: AppStore): CatalogView => {
  const { full } = store.getState().catalog;
  if (full.status !== 'success') {
    throw new Error(`The catalog is ${full.status}`);
  }
  return full.data;
};

const shownCatalog = (store: AppStore): CatalogView => {
  const { view } = store.getState().catalog;
  if (view.status !== 'success') {
    throw new Error(`The catalog view is ${view.status}`);
  }
  return view.data;
};

const shownNames = (store: AppStore) =>
  shownCatalog(store).sections.map((section) =>
    section.articles.map((article) => article.name),
  );

const shownArticle = (store: AppStore, name: string) =>
  shownCatalog(store)
    .sections.flatMap((section) => section.articles)
    .find((article) => article.name === name);

const currentList = (store: AppStore): CurrentListView => {
  const region = store.getState().currentList;
  if (region.status !== 'success') {
    throw new Error(`The current list is ${region.status}`);
  }
  return region.data;
};

const listed = (store: AppStore) =>
  currentList(store).sections.flatMap((section) => section.items);

/** A store with the current list loaded and "Beurre" just removed: the offer is pending. */
const buildStoreWithOffer = async (
  replace?: (real: UseCases) => Partial<UseCases>,
) => {
  const built = await buildStore(replace);
  await built.store.getState().loadCurrentList();
  await built.store.getState().removeItem(beurre.id);
  return built;
};

describe('editing the current list in the store', () => {
  describe('loadCatalog', () => {
    it('US2-17 R11a shows loading, then the full catalog of the current list, read once with no query', async () => {
      const { store, getCatalog } = await buildStore();

      const loading = store.getState().loadCatalog();
      const seen = store.getState().catalog;
      await loading;

      expect(seen.full.status).toBe('loading');
      expect(seen.view.status).toBe('loading');
      expect(getCatalog).toHaveBeenCalledTimes(1);
      expect(getCatalog).toHaveBeenCalledWith(maListe);
      expect(store.getState().catalog.query).toBe('');
      expect(shownCatalog(store)).toEqual(fullCatalog(store));
      expect(shownNames(store)).toEqual([
        ['Pommes', 'Pommes de terre'],
        ['Beurre', 'Lait'],
        [],
      ]);
    });

    it('US2-18 shows the error state and reports getCatalog when it throws, and loads again on retry', async () => {
      let calls = 0;
      const { store, errorReporter } = await buildStore((real) => ({
        getCatalog: (...args) => {
          calls += 1;
          return calls === 1
            ? Promise.reject(new Error('catalog failed'))
            : real.getCatalog(...args);
        },
      }));

      await store.getState().loadCatalog();

      expect(store.getState().catalog.full.status).toBe('error');
      expect(store.getState().catalog.view.status).toBe('error');
      expect(errorReporter.reports).toEqual([
        { error: expect.any(Error), context: { operation: 'getCatalog' } },
      ]);

      await store.getState().loadCatalog();

      expect(shownNames(store)[0]).toEqual(['Pommes', 'Pommes de terre']);
      expect(errorReporter.reports).toHaveLength(1);
    });
  });

  describe('searchCatalog', () => {
    it('SC-011 R11a filters the loaded catalog on each letter, with no storage read, no loading state and no report', async () => {
      let calls = 0;
      const { store, errorReporter } = await buildStore((real) => ({
        getCatalog: (...args) => {
          calls += 1;
          return calls === 1
            ? real.getCatalog(...args)
            : Promise.reject(new Error('read again'));
        },
      }));
      await store.getState().loadCatalog();
      const statuses: string[] = [];
      const unsubscribe = store.subscribe((state) =>
        statuses.push(state.catalog.view.status),
      );

      store.getState().searchCatalog('p');
      expect(shownNames(store)).toEqual([['Pommes', 'Pommes de terre']]);
      store.getState().searchCatalog('po');
      expect(shownNames(store)).toEqual([['Pommes', 'Pommes de terre']]);
      store.getState().searchCatalog('pom');
      expect(shownNames(store)).toEqual([['Pommes', 'Pommes de terre']]);
      unsubscribe();

      expect(store.getState().catalog.query).toBe('pom');
      expect(statuses).not.toContain('loading');
      expect(calls).toBe(1);
      expect(errorReporter.reports).toEqual([]);
    });

    it('US2-10 FR-009 shows the full catalog for a query of spaces', async () => {
      const { store } = await buildStore();
      await store.getState().loadCatalog();

      store.getState().searchCatalog('   ');

      expect(store.getState().catalog.view).toEqual(
        store.getState().catalog.full,
      );
    });

    it('US2-14 shows the empty state with the query when nothing matches', async () => {
      const { store } = await buildStore();
      await store.getState().loadCatalog();

      store.getState().searchCatalog('xyz');

      expect(store.getState().catalog.view).toEqual({
        status: 'empty',
        detail: { query: 'xyz' },
      });
    });

    it('R11a applies the query again after a write reloads the catalog, so an article just added shows its mark', async () => {
      const { store } = await buildStore();
      await store.getState().loadCatalog();
      store.getState().searchCatalog('pom');

      await store.getState().addArticleToList(pommes, null);

      expect(shownNames(store)).toEqual([['Pommes', 'Pommes de terre']]);
      expect(shownArticle(store, 'Pommes')?.onList).toBe(true);
      expect(shownArticle(store, 'Pommes de terre')?.onList).toBe(false);
    });
  });

  describe('loadCategories', () => {
    it('US2-7 loads the categories in order', async () => {
      const { store } = await buildStore();

      await store.getState().loadCategories();

      expect(store.getState().categories).toEqual({
        status: 'success',
        data: [
          { id: fruits, name: 'Fruits et légumes' },
          { id: cremerie, name: 'Crèmerie' },
          { id: boissons, name: 'Boissons' },
        ],
      });
    });

    it('shows the error state and reports getCategories when it throws', async () => {
      const { store, errorReporter } = await buildStore(() => ({
        getCategories: () => Promise.reject(new Error('categories failed')),
      }));

      await store.getState().loadCategories();

      expect(store.getState().categories.status).toBe('error');
      expect(errorReporter.reports).toEqual([
        { error: expect.any(Error), context: { operation: 'getCategories' } },
      ]);
    });
  });

  describe('addArticleToList', () => {
    it('US2-1 adds the article to the current list, refreshes, and confirms it with its name', async () => {
      const { store, stored } = await buildStore();
      await store.getState().loadCurrentList();

      const outcome = await store.getState().addArticleToList(pommes, {
        amount: 1,
        unit: 'kg',
      });

      expect(outcome).toEqual(ok(undefined));
      expect(await stored(pommes.id)).toEqual({
        listId: maListe,
        articleId: pommes.id,
        inCart: false,
        quantity: { amount: 1, unit: 'kg' },
      });
      expect(listed(store).map((item) => item.name)).toContain('Pommes');
      expect(store.getState().notice).toEqual({
        type: 'articleAdded',
        name: 'Pommes',
      });
    });

    it('US2-8 returns AlreadyOnList with the current quantity, with no notice and no report', async () => {
      const { store, errorReporter } = await buildStore();

      const outcome = await store.getState().addArticleToList(lait, null);

      expect(outcome).toEqual(
        err({ type: 'AlreadyOnList', quantity: { amount: 2, unit: 'L' } }),
      );
      expect(store.getState().notice).toBeNull();
      expect(errorReporter.reports).toEqual([]);
    });
  });

  describe('createArticleAndAddToList', () => {
    it('US2-7 creates and adds the article, refreshes, and confirms it with its clean name', async () => {
      const { store } = await buildStore();
      await store.getState().loadCatalog();

      const outcome = await store
        .getState()
        .createArticleAndAddToList(
          { name: '  Houmous ', categoryId: boissons },
          null,
        );

      expect(outcome.ok).toBe(true);
      expect(shownNames(store)[2]).toEqual(['Houmous']);
      expect(shownArticle(store, 'Houmous')?.onList).toBe(true);
      expect(store.getState().notice).toEqual({
        type: 'articleAdded',
        name: 'Houmous',
      });
    });

    it('US2-9 returns NameAlreadyUsed with the existing article, with no notice and no report', async () => {
      const { store, errorReporter } = await buildStore();

      const outcome = await store
        .getState()
        .createArticleAndAddToList(
          { name: ' beurre ', categoryId: boissons },
          null,
        );

      expect(outcome).toEqual(
        err({
          type: 'NameAlreadyUsed',
          existing: { ...beurre, categoryId: cremerie },
        }),
      );
      expect(store.getState().notice).toBeNull();
      expect(errorReporter.reports).toEqual([]);
    });
  });

  describe('changeItemQuantity', () => {
    it('US2-3 changes the quantity and refreshes the current list', async () => {
      const { store } = await buildStore();
      await store.getState().loadCurrentList();

      const outcome = await store
        .getState()
        .changeItemQuantity(lait.id, { amount: 3, unit: 'L' });

      expect(outcome).toEqual(ok(undefined));
      expect(listed(store).find((item) => item.name === 'Lait')).toMatchObject({
        quantity: { amount: 3, unit: 'L' },
      });
    });
  });

  describe('removeItem and the undo offer', () => {
    it('US2-6 removes the item, refreshes, and offers to undo with the removed item and its name', async () => {
      const { store, stored } = await buildStoreWithOffer();

      expect(await stored(beurre.id)).toBeNull();
      expect(listed(store).map((item) => item.name)).toEqual(['Lait']);
      expect(store.getState().pendingUndo).toEqual({
        kind: 'removedItem',
        removed: {
          listId: maListe,
          articleId: beurre.id,
          inCart: true,
          quantity: { amount: 2, unit: 'kg' },
        },
        name: 'Beurre',
      });
    });

    it('FR-004 saves a removal queued behind a failed toggle of the same item, with the tick stored on the device', async () => {
      const { store, stored } = await buildStore(() => ({
        toggleItemInCart: () => Promise.reject(new Error('toggle failed')),
      }));
      await store.getState().loadCurrentList();

      const toggled = store.getState().toggleItem(lait.id);
      const removed = store.getState().removeItem(lait.id);
      await Promise.all([toggled, removed]);

      expect(await removed).toEqual(ok(undefined));
      expect(await stored(lait.id)).toBeNull();
      expect(store.getState().pendingUndo).toMatchObject({
        removed: { articleId: lait.id, inCart: false },
        name: 'Lait',
      });
    });

    it('US2-16 undo() ends the offer at once, then puts the item back as it was and refreshes', async () => {
      const { store, stored } = await buildStoreWithOffer();

      const undone = store.getState().undo();
      expect(store.getState().pendingUndo).toBeNull();
      await undone;

      expect(await stored(beurre.id)).toEqual({
        listId: maListe,
        articleId: beurre.id,
        inCart: true,
        quantity: { amount: 2, unit: 'kg' },
      });
      expect(listed(store).map((item) => item.name)).toEqual([
        'Lait',
        'Beurre',
      ]);
    });

    it('FR-010 R8 a failed undo leaves the item removed and the offer ended, shows writeFailed and reports restoreRemovedItem', async () => {
      const { store, stored, errorReporter } = await buildStoreWithOffer(
        () => ({
          restoreRemovedItem: () => Promise.reject(new Error('restore failed')),
        }),
      );

      await store.getState().undo();

      expect(await stored(beurre.id)).toBeNull();
      expect(store.getState().pendingUndo).toBeNull();
      expect(store.getState().notice).toEqual({ type: 'writeFailed' });
      expect(errorReporter.reports).toEqual([
        {
          error: expect.any(Error),
          context: { operation: 'restoreRemovedItem' },
        },
      ]);
    });

    it('ends the notice shown, so its snackbar never covers the undo offer', async () => {
      const { store } = await buildStore();
      await store.getState().loadCurrentList();
      await store.getState().addArticleToList(pommes, null);
      expect(store.getState().notice).not.toBeNull();

      await store.getState().removeItem(beurre.id);

      expect(store.getState().notice).toBeNull();
      expect(store.getState().pendingUndo).toMatchObject({ name: 'Beurre' });
    });

    it('FR-010 dismissUndo() ends the offer, and the removal stays', async () => {
      const { store, stored } = await buildStoreWithOffer();

      store.getState().dismissUndo();

      expect(store.getState().pendingUndo).toBeNull();
      expect(await stored(beurre.id)).toBeNull();
    });

    it('FR-010 a toggle that succeeds ends the offer', async () => {
      const { store } = await buildStoreWithOffer();

      await store.getState().toggleItem(lait.id);

      expect(store.getState().pendingUndo).toBeNull();
    });

    it('FR-010 a write that fails leaves the offer', async () => {
      const { store } = await buildStoreWithOffer(() => ({
        changeItemQuantity: () => Promise.reject(new Error('disk failed')),
      }));

      await store.getState().changeItemQuantity(lait.id, null);

      expect(store.getState().pendingUndo).toMatchObject({ name: 'Beurre' });
    });

    it('FR-010 input refused by a use case leaves the offer', async () => {
      const { store } = await buildStoreWithOffer();

      await store
        .getState()
        .createArticleAndAddToList({ name: '  ', categoryId: boissons }, null);
      await store.getState().addArticleToList(lait, null);

      expect(store.getState().pendingUndo).toMatchObject({ name: 'Beurre' });
    });

    it('R8 carries out an undo() called behind a queued write, even though that write ends the offer', async () => {
      const { released, release } = deferred();
      const { store, stored } = await buildStoreWithOffer((real) => ({
        changeItemQuantity: async (...args) => {
          await released;
          return real.changeItemQuantity(...args);
        },
      }));

      const changed = store
        .getState()
        .changeItemQuantity(lait.id, { amount: 1, unit: 'L' });
      const undone = store.getState().undo();
      await settle();
      release();
      await Promise.all([changed, undone]);

      expect(await stored(beurre.id)).toMatchObject({ inCart: true });
      expect(store.getState().pendingUndo).toBeNull();
    });

    it('FR-010 a new removal replaces the previous offer', async () => {
      const { store } = await buildStoreWithOffer();

      await store.getState().removeItem(lait.id);

      expect(store.getState().pendingUndo).toMatchObject({
        removed: { articleId: lait.id },
        name: 'Lait',
      });
    });

    it('FR-010 a store built afresh on the same fakes, as when the app is closed, has no offer: the removal is final', async () => {
      const { stored, useCases } = await buildStoreWithOffer();

      const reopened = createAppStore({
        useCases,
        errorReporter: new RecordingErrorReporter(),
      });

      expect(reopened.getState().pendingUndo).toBeNull();
      expect(await stored(beurre.id)).toBeNull();
    });
  });
});
