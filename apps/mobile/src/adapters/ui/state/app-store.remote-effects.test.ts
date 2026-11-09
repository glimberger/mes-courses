import type { SyncResult } from '../../../application/use-cases/synchronize';
import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { fixture } from '../testing/fixtures';
import { buildStoryStore } from '../testing/story-store';
import type { UseCases } from '../use-cases';
import { createAppStore } from './app-store';
import { shownList } from './current-list-actions';

const lait = 'article-lait' as ArticleId;
const pommes = 'article-pommes' as ArticleId;
const farine = 'article-farine' as ArticleId;
const beurre = 'article-beurre' as ArticleId;
const maListe = 'list-ma-liste' as ListId;

const cycleWith = (effects: Partial<SyncResult['effects']>): SyncResult => ({
  outcome: { type: 'saved' },
  effects: {
    deletedArticles: [],
    deletedLists: [],
    removedItems: [],
    merges: [],
    ...effects,
  },
  pulledRows: 1,
});

const buildStore = async () => {
  const built = await buildStoryStore({ seed: fixture });
  const synchronize = jest.fn(async (): Promise<SyncResult> => cycleWith({}));
  const changeItemQuantity = jest.fn(built.useCases.changeItemQuantity);
  const toggleItemInCart = jest.fn(built.useCases.toggleItemInCart);
  const editArticle = jest.fn(built.useCases.editArticle);
  const useCases: UseCases = {
    ...built.useCases,
    synchronize,
    changeItemQuantity,
    toggleItemInCart,
    editArticle,
  };
  const store = createAppStore({
    useCases,
    errorReporter: new RecordingErrorReporter(),
  });
  await store.getState().loadCurrentList();
  return {
    store,
    synchronize,
    changeItemQuantity,
    toggleItemInCart,
    editArticle,
  };
};

describe('the effects of a pull on the store (FR-020a, research R10a)', () => {
  it('fills the redirects from the merges of a cycle, in memory only', async () => {
    const { store, synchronize } = await buildStore();
    synchronize.mockResolvedValueOnce(
      cycleWith({
        merges: [
          { kind: 'article', loserId: pommes, survivorId: lait },
          { kind: 'list', loserId: 'list-b', survivorId: maListe },
        ],
      }),
    );

    await store.getState().syncNow();

    expect(store.getState().sync.redirects).toEqual({
      [pommes]: lait,
      'list-b': maListe,
    });
  });

  it('keeps the redirects of earlier cycles', async () => {
    const { store, synchronize } = await buildStore();
    synchronize.mockResolvedValueOnce(
      cycleWith({
        merges: [{ kind: 'article', loserId: pommes, survivorId: lait }],
      }),
    );
    await store.getState().syncNow();
    synchronize.mockResolvedValueOnce(
      cycleWith({
        merges: [{ kind: 'article', loserId: lait, survivorId: farine }],
      }),
    );

    await store.getState().syncNow();

    expect(store.getState().sync.redirects).toEqual({
      [pommes]: lait,
      [lait]: farine,
    });
  });

  it('calls the use case with the survivor of a merged article, following chains', async () => {
    const { store, synchronize, changeItemQuantity } = await buildStore();
    synchronize.mockResolvedValueOnce(
      cycleWith({
        merges: [
          { kind: 'article', loserId: beurre, survivorId: pommes },
          { kind: 'article', loserId: pommes, survivorId: farine },
        ],
      }),
    );
    await store.getState().syncNow();

    await store
      .getState()
      .changeItemQuantity(beurre, { amount: 3, unit: null });

    expect(changeItemQuantity).toHaveBeenCalledWith(maListe, farine, {
      amount: 3,
      unit: null,
    });
  });

  it('redirects the other write actions that take an article', async () => {
    const { store, synchronize, toggleItemInCart, editArticle } =
      await buildStore();
    synchronize.mockResolvedValueOnce(
      cycleWith({
        merges: [{ kind: 'article', loserId: beurre, survivorId: lait }],
      }),
    );
    await store.getState().syncNow();

    await store.getState().editArticle(beurre, {
      name: 'Lait demi-écrémé',
      categoryId: fixture.articles[0]?.categoryId as never,
    });
    await store.getState().toggleItem(beurre);

    expect(editArticle).toHaveBeenCalledWith(lait, expect.anything());
    expect(toggleItemInCart).toHaveBeenCalledWith(maListe, lait);
  });

  it('leaves an id that no merge touched as it is', async () => {
    const { store, changeItemQuantity } = await buildStore();

    await store.getState().changeItemQuantity(lait, null);

    expect(changeItemQuantity).toHaveBeenCalledWith(maListe, lait, null);
  });

  it('publishes the effects of each cycle with a number that grows, so a form sees only later ones', async () => {
    const { store, synchronize } = await buildStore();
    const first = store.getState().sync.remote.cycle;
    synchronize.mockResolvedValueOnce(cycleWith({ deletedArticles: [lait] }));

    await store.getState().syncNow();

    expect(store.getState().sync.remote.cycle).toBeGreaterThan(first);
    expect(store.getState().sync.remote.effects.deletedArticles).toEqual([
      lait,
    ]);
  });

  it('012 US3-2 publishes the lists a cycle deleted, without a notice', async () => {
    const { store, synchronize } = await buildStore();
    synchronize.mockResolvedValueOnce(
      cycleWith({ deletedLists: ['list-barbecue'] }),
    );

    await store.getState().syncNow();

    expect(store.getState().sync.remote.effects.deletedLists).toEqual([
      'list-barbecue',
    ]);
    expect(store.getState().notice).toBeNull();
  });

  it('012 edge case 1: a cycle deleting the current list reloads the lists and the current list', async () => {
    const built = await buildStoryStore({ seed: fixture });
    const barbecue = 'list-barbecue' as ListId;
    // What a pull deleting "Ma liste" leaves (synchronize.test.ts covers how).
    const synchronize = jest.fn(async (): Promise<SyncResult> => {
      await built.unitOfWork.run(async (repos) => {
        await repos.appState.setCurrentListId(barbecue);
        await repos.items.removeAllForList(maListe);
        await repos.lists.remove(maListe);
      });
      return cycleWith({ deletedLists: [maListe] });
    });
    const store = createAppStore({
      useCases: { ...built.useCases, synchronize },
      errorReporter: new RecordingErrorReporter(),
    });
    await store.getState().loadCurrentList();
    await store.getState().loadLists();

    await store.getState().syncNow();

    const { currentList, lists } = store.getState();
    expect(shownList(currentList)).toEqual(
      expect.objectContaining({ id: barbecue, name: 'Barbecue' }),
    );
    expect(lists.status === 'success' && lists.data).toEqual([
      { id: barbecue, name: 'Barbecue', itemCount: 0, isCurrent: true },
    ]);
  });
});
