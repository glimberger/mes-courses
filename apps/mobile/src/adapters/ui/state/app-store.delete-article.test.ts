import type { UnitOfWork } from '../../../application/ports/unit-of-work';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import { err, ok } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import { buildStoryStore, type Fixture } from '../testing/story-store';
import type { UseCases } from '../use-cases';
import { createAppStore, type AppStore } from './app-store';

const maListe = 'list-ma-liste' as ListId;
const barbecue = 'list-barbecue' as ListId;
const cremerie = 'category-cremerie' as CategoryId;
const lait = { id: 'article-lait' as ArticleId, name: 'Lait' };
const beurre = { id: 'article-beurre' as ArticleId, name: 'Beurre' };

/** "Lait" (2 L, ticked) is on "Ma liste" and "Barbecue"; "Beurre" is on "Ma liste" only. */
const seed: Fixture = {
  categories: [{ id: cremerie, name: 'Crèmerie', position: 0 }],
  articles: [
    { ...lait, categoryId: cremerie },
    { ...beurre, categoryId: cremerie },
  ],
  lists: [
    { id: maListe, name: 'Ma liste' },
    { id: barbecue, name: 'Barbecue' },
  ],
  items: [
    {
      listId: maListe,
      articleId: lait.id,
      inCart: true,
      quantity: { amount: 2, unit: 'L' },
    },
    { listId: barbecue, articleId: lait.id, inCart: false, quantity: null },
    { listId: maListe, articleId: beurre.id, inCart: false, quantity: null },
  ],
  currentListId: maListe,
};

const buildStore = async (
  replace: (real: UseCases) => Partial<UseCases> = () => ({}),
) => {
  const built = await buildStoryStore({ seed });
  const useCases: UseCases = { ...built.useCases, ...replace(built.useCases) };
  const errorReporter = new RecordingErrorReporter();
  const store = createAppStore({ useCases, errorReporter });
  return { store, errorReporter, unitOfWork: built.unitOfWork, useCases };
};

const buildLoadedStore = async (
  replace?: (real: UseCases) => Partial<UseCases>,
) => {
  const built = await buildStore(replace);
  await built.store.getState().loadCurrentList();
  await built.store.getState().loadCatalog();
  await built.store.getState().loadLists();
  return built;
};

const catalogNames = (store: AppStore) => {
  const { full } = store.getState().catalog;
  if (full.status !== 'success') throw new Error('No catalog');
  return full.data.sections.flatMap((section) =>
    section.articles.map((article) => article.name),
  );
};

const storedLait = (unitOfWork: UnitOfWork) =>
  unitOfWork.run((repos) => repos.articles.findById(lait.id));

describe('deleting an article in the store', () => {
  it('getArticleUsage returns the use case Result and stores nothing', async () => {
    const { store } = await buildLoadedStore();
    const before = store.getState();

    const outcome = await store.getState().getArticleUsage(lait.id);

    expect(outcome).toEqual(
      ok({
        article: lait,
        lists: [
          { id: barbecue, name: 'Barbecue' },
          { id: maListe, name: 'Ma liste' },
        ],
      }),
    );
    const after = store.getState();
    expect(after.pendingUndo).toBe(before.pendingUndo);
    expect(after.notice).toBe(before.notice);
    expect(after.currentList).toBe(before.currentList);
    expect(after.catalog).toBe(before.catalog);
  });

  it('US2-1 US2-4 on success offers the undo and refreshes every loaded region', async () => {
    const { store } = await buildLoadedStore();

    const outcome = await store.getState().deleteArticle(lait.id);

    expect(outcome.ok).toBe(true);
    expect(store.getState().pendingUndo).toEqual({
      kind: 'deletedArticle',
      deleted: {
        undoId: expect.any(String),
        article: { ...lait, categoryId: cremerie },
        items: expect.arrayContaining([
          { listId: maListe, inCart: true, quantity: { amount: 2, unit: 'L' } },
          { listId: barbecue, inCart: false, quantity: null },
        ]),
      },
    });
    expect(catalogNames(store)).not.toContain('Lait');
    const { currentList, lists } = store.getState();
    if (currentList.status !== 'success') throw new Error('No current list');
    expect(
      currentList.data.sections.flatMap((section) =>
        section.items.map((item) => item.name),
      ),
    ).toEqual(['Beurre']);
    if (lists.status !== 'success') throw new Error('No lists');
    expect(lists.data.map((list) => list.itemCount)).toEqual([0, 1]);
  });

  it('replaces any pending offer: a new deletion replaces an item removal, and the reverse', async () => {
    const { store } = await buildLoadedStore();

    await store.getState().removeItem(beurre.id);
    expect(store.getState().pendingUndo?.kind).toBe('removedItem');
    await store.getState().deleteArticle(lait.id);
    expect(store.getState().pendingUndo?.kind).toBe('deletedArticle');

    await store.getState().deleteArticle(beurre.id);
    expect(store.getState().pendingUndo).toMatchObject({
      kind: 'deletedArticle',
      deleted: { article: { id: beurre.id } },
    });
  });

  it('undo() with a deleted article clears the offer, restores everything and refreshes', async () => {
    const { store, unitOfWork } = await buildLoadedStore();
    await store.getState().deleteArticle(lait.id);

    await store.getState().undo();

    expect(store.getState().pendingUndo).toBeNull();
    expect(await storedLait(unitOfWork)).toEqual({
      ...lait,
      categoryId: cremerie,
    });
    expect(
      await unitOfWork.run((repos) => repos.items.find(maListe, lait.id)),
    ).toEqual({
      listId: maListe,
      articleId: lait.id,
      inCart: true,
      quantity: { amount: 2, unit: 'L' },
    });
    expect(catalogNames(store)).toContain('Lait');
  });

  it('edge case: when the restore throws, the article stays deleted, writeFailed shows and the error is reported', async () => {
    const { store, errorReporter, unitOfWork } = await buildLoadedStore(() => ({
      restoreDeletedArticle: () => Promise.reject(new Error('disk failed')),
    }));
    await store.getState().deleteArticle(lait.id);

    await store.getState().undo();

    expect(store.getState().pendingUndo).toBeNull();
    expect(store.getState().notice).toEqual({ type: 'writeFailed' });
    expect(await storedLait(unitOfWork)).toBeNull();
    expect(errorReporter.reports).toEqual([
      {
        error: expect.any(Error),
        context: { operation: 'restoreDeletedArticle' },
      },
    ]);
  });

  it('US2-6 any other write that succeeds ends the offer', async () => {
    const { store } = await buildLoadedStore();
    await store.getState().deleteArticle(lait.id);

    await store.getState().toggleItem(beurre.id);

    expect(store.getState().pendingUndo).toBeNull();
  });

  it('US2-6 FR-010 a failed write, or refused input, leaves the offer', async () => {
    const { store } = await buildLoadedStore(() => ({
      createList: () => Promise.reject(new Error('disk failed')),
    }));
    await store.getState().deleteArticle(lait.id);
    const offer = store.getState().pendingUndo;

    await store.getState().createList('Pique-nique');
    expect(store.getState().pendingUndo).toBe(offer);

    expect(
      await store
        .getState()
        .editArticle(beurre.id, { name: '   ', categoryId: cremerie }),
    ).toEqual(err({ type: 'NameRequired' }));
    expect(store.getState().pendingUndo).toBe(offer);
  });

  it('a deletion that fails leaves the pending offer and shows writeFailed', async () => {
    const { store, errorReporter } = await buildLoadedStore(() => ({
      deleteArticle: () => Promise.reject(new Error('disk failed')),
    }));
    await store.getState().removeItem(beurre.id);
    const offer = store.getState().pendingUndo;

    const outcome = await store.getState().deleteArticle(lait.id);

    expect(outcome).toEqual(err({ type: 'WriteFailed' }));
    expect(store.getState().pendingUndo).toBe(offer);
    expect(store.getState().notice).toEqual({ type: 'writeFailed' });
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'deleteArticle' } },
    ]);
  });

  it('dismissUndo() ends the offer: the deletion is final', async () => {
    const { store, unitOfWork } = await buildLoadedStore();
    await store.getState().deleteArticle(lait.id);

    store.getState().dismissUndo();
    await store.getState().undo();

    expect(store.getState().pendingUndo).toBeNull();
    expect(await storedLait(unitOfWork)).toBeNull();
  });

  it('edge case: a store built afresh on the same fakes, as after a killed app, has no offer', async () => {
    const { store, useCases, unitOfWork } = await buildLoadedStore();
    await store.getState().deleteArticle(lait.id);

    const restarted = createAppStore({
      useCases,
      errorReporter: new RecordingErrorReporter(),
    });

    expect(restarted.getState().pendingUndo).toBeNull();
    expect(await storedLait(unitOfWork)).toBeNull();
  });
});
