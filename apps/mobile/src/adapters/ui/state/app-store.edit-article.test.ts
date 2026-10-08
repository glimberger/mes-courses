import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import { err, ok } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import { buildStoryStore, type Fixture } from '../testing/story-store';
import type { UseCases } from '../use-cases';
import { createAppStore, type AppStore } from './app-store';

const maListe = 'list-ma-liste' as ListId;
const cremerie = 'category-cremerie' as CategoryId;
const lait = { id: 'article-lait' as ArticleId, name: 'Lait' };
const beurre = { id: 'article-beurre' as ArticleId, name: 'Beurre' };

/** "Ma liste" holds "Lait" (2 L) and "Beurre" (ticked, 2 kg). */
const seed: Fixture = {
  categories: [{ id: cremerie, name: 'Crèmerie', position: 0 }],
  articles: [
    { ...lait, categoryId: cremerie },
    { ...beurre, categoryId: cremerie },
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

const buildStore = async (
  replace: (real: UseCases) => Partial<UseCases> = () => ({}),
) => {
  const built = await buildStoryStore({ seed });
  const useCases: UseCases = { ...built.useCases, ...replace(built.useCases) };
  const errorReporter = new RecordingErrorReporter();
  const store = createAppStore({ useCases, errorReporter });
  return { store, errorReporter, unitOfWork: built.unitOfWork };
};

/** The names the region shows, whatever its status says about the rest. */
const regionNames = (store: AppStore) => {
  const { currentList, catalog, lists } = store.getState();
  if (currentList.status !== 'success') throw new Error('No current list');
  if (catalog.full.status !== 'success') throw new Error('No catalog');
  if (lists.status !== 'success') throw new Error('No lists');
  return {
    currentList: currentList.data.sections.flatMap((section) =>
      section.items.map((item) => item.name),
    ),
    catalog: catalog.full.data.sections.flatMap((section) =>
      section.articles.map((article) => article.name),
    ),
  };
};

/** A store with the current list, the catalog and the lists loaded, and an undo offer pending. */
const buildLoadedStore = async (
  replace?: (real: UseCases) => Partial<UseCases>,
) => {
  const built = await buildStore(replace);
  await built.store.getState().loadCurrentList();
  await built.store.getState().loadCatalog();
  await built.store.getState().loadLists();
  await built.store.getState().removeItem(beurre.id);
  return built;
};

describe('editing an article in the store', () => {
  it('FR-010 clears the undo offer first', async () => {
    const { store } = await buildLoadedStore();
    expect(store.getState().pendingUndo).not.toBeNull();

    await store
      .getState()
      .editArticle(lait.id, { name: 'Lait demi-écrémé', categoryId: cremerie });

    expect(store.getState().pendingUndo).toBeNull();
  });

  it('returns the use case Result unchanged and does not report a business error', async () => {
    const { store, errorReporter } = await buildLoadedStore();

    const outcome = await store
      .getState()
      .editArticle(lait.id, { name: ' beurre ', categoryId: cremerie });

    expect(outcome).toEqual(
      err({
        type: 'NameAlreadyUsed',
        existing: { ...beurre, categoryId: cremerie },
      }),
    );
    expect(store.getState().notice).toBeNull();
    expect(errorReporter.reports).toEqual([]);
  });

  it('US1-1 US1-2 refreshes every loaded region, so the current list, the catalog and the lists show the new name', async () => {
    const { store } = await buildLoadedStore();

    const outcome = await store
      .getState()
      .editArticle(lait.id, { name: 'Lait demi-écrémé', categoryId: cremerie });

    expect(outcome).toEqual(ok(undefined));
    const names = regionNames(store);
    expect(names.currentList).toEqual(['Lait demi-écrémé']);
    expect(names.catalog).toContain('Lait demi-écrémé');
    expect(names.catalog).not.toContain('Lait');
    expect(store.getState().lists.status).toBe('success');
  });

  it('FR-009 on a throw reports editArticle, shows writeFailed and resolves to WriteFailed', async () => {
    const { store, errorReporter } = await buildLoadedStore(() => ({
      editArticle: () => Promise.reject(new Error('disk failed')),
    }));

    const outcome = await store
      .getState()
      .editArticle(lait.id, { name: 'Lait demi-écrémé', categoryId: cremerie });

    expect(outcome).toEqual(err({ type: 'WriteFailed' }));
    expect(store.getState().notice).toEqual({ type: 'writeFailed' });
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'editArticle' } },
    ]);
  });
});
