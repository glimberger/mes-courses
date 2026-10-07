import { StorageFull } from '../../../application/ports/storage-full';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import type { CurrentListView } from '../../../domain/current-list-view';
import { err, ok } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import { buildStoryStore, type Fixture } from '../testing/story-store';
import type { UseCases } from '../use-cases';
import { createAppStore, type AppStore } from './app-store';

const maListe = 'list-ma-liste' as ListId;
const cremerie = 'category-cremerie' as CategoryId;
const fruits = 'category-fruits' as CategoryId;
const lait = 'article-lait' as ArticleId;
const beurre = 'article-beurre' as ArticleId;
const pommes = 'article-pommes' as ArticleId;

/** "Ma liste" with three items, none of them in the cart. */
const nothingInCart: Fixture = {
  categories: [
    { id: fruits, name: 'Fruits et légumes', position: 0 },
    { id: cremerie, name: 'Crèmerie', position: 1 },
  ],
  articles: [
    { id: lait, name: 'Lait', categoryId: cremerie },
    { id: beurre, name: 'Beurre', categoryId: cremerie },
    { id: pommes, name: 'Pommes', categoryId: fruits },
  ],
  lists: [{ id: maListe, name: 'Ma liste' }],
  items: [
    {
      listId: maListe,
      articleId: lait,
      inCart: false,
      quantity: { amount: 2, unit: 'L' },
    },
    { listId: maListe, articleId: beurre, inCart: false, quantity: null },
    { listId: maListe, articleId: pommes, inCart: false, quantity: null },
  ],
  currentListId: maListe,
};

const emptyList: Fixture = { ...nothingInCart, items: [] };

type ToggleItemInCart = UseCases['toggleItemInCart'];
type Release = (outcome?: 'saved' | 'fails' | 'storageFull') => void;

/**
 * `toggleItemInCart` held until the test releases each call: saved by the real use case, or
 * failing before anything is saved.
 */
const heldToggles = (real: ToggleItemInCart) => {
  const calls: { articleId: ArticleId; release: Release }[] = [];
  const toggleItemInCart = jest.fn<
    ReturnType<ToggleItemInCart>,
    Parameters<ToggleItemInCart>
  >(
    (listId, articleId) =>
      new Promise((resolve, reject) => {
        calls.push({
          articleId,
          release: (outcome = 'saved') => {
            if (outcome === 'saved') {
              real(listId, articleId).then(resolve, reject);
            } else {
              reject(
                outcome === 'storageFull'
                  ? new StorageFull()
                  : new Error('toggle failed'),
              );
            }
          },
        });
      }),
  );
  return { toggleItemInCart, calls };
};

/** Lets every queued promise run: the fakes and the store only chain promises. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A store on the real use cases over in-memory fakes holding `seed`, except the use cases the
 * test replaces. Every call of a write use case is recorded in `calls`, in the order it started.
 */
const buildStore = async (
  seed: Fixture,
  replace: (real: UseCases) => Partial<UseCases> = () => ({}),
) => {
  const built = await buildStoryStore({ seed });
  const calls: string[] = [];
  const replaced = { ...built.useCases, ...replace(built.useCases) };
  const useCases: UseCases = {
    ...replaced,
    toggleItemInCart: (listId, articleId) => {
      calls.push(`toggle ${articleId}`);
      return replaced.toggleItemInCart(listId, articleId);
    },
    finishShopping: (listId) => {
      calls.push('finish');
      return replaced.finishShopping(listId);
    },
  };
  const errorReporter = new RecordingErrorReporter();
  const store = createAppStore({ useCases, errorReporter });
  const stored = (articleId: ArticleId) =>
    built.unitOfWork.run(
      async (repos) => (await repos.items.find(maListe, articleId))?.inCart,
    );
  return { store, errorReporter, calls, stored };
};

/** A store whose `toggleItemInCart` calls wait for the test, with the current list loaded. */
const buildHeldStore = async (seed: Fixture = nothingInCart) => {
  let held!: ReturnType<typeof heldToggles>;
  const built = await buildStore(seed, (real) => {
    held = heldToggles(real.toggleItemInCart);
    return { toggleItemInCart: held.toggleItemInCart };
  });
  await built.store.getState().loadCurrentList();
  return { ...built, held };
};

const view = (store: AppStore): CurrentListView => {
  const region = store.getState().currentList;
  if (region.status !== 'success') {
    throw new Error(`The current list is ${region.status}`);
  }
  return region.data;
};

const items = (store: AppStore) =>
  view(store).sections.flatMap((section) => section.items);

/** Whether the item is shown in the cart. */
const shownInCart = (store: AppStore, articleId: ArticleId) =>
  items(store).find((item) => item.articleId === articleId)?.inCart;

const namesShown = (store: AppStore) =>
  view(store).sections.map((section) => section.items.map((i) => i.name));

describe('the current list in the store', () => {
  describe('loadCurrentList', () => {
    it('US1-11 shows loading, then the current list', async () => {
      const { store } = await buildStore(nothingInCart);

      const loading = store.getState().loadCurrentList();
      const seen = store.getState().currentList;
      await loading;

      expect(seen).toEqual({ status: 'loading' });
      expect(store.getState().currentList).toEqual({
        status: 'success',
        data: {
          list: { id: maListe, name: 'Ma liste' },
          remainingCount: 3,
          totalCount: 3,
          hasItemsInCart: false,
          sections: [
            {
              category: { id: fruits, name: 'Fruits et légumes' },
              items: [
                {
                  articleId: pommes,
                  name: 'Pommes',
                  inCart: false,
                  quantity: null,
                },
              ],
            },
            {
              category: { id: cremerie, name: 'Crèmerie' },
              items: [
                {
                  articleId: beurre,
                  name: 'Beurre',
                  inCart: false,
                  quantity: null,
                },
                {
                  articleId: lait,
                  name: 'Lait',
                  inCart: false,
                  quantity: { amount: 2, unit: 'L' },
                },
              ],
            },
          ],
        },
      });
    });

    it('US1-10 shows a list with no item as empty, with its name', async () => {
      const { store } = await buildStore(emptyList);

      await store.getState().loadCurrentList();

      expect(store.getState().currentList).toEqual({
        status: 'empty',
        detail: { list: { id: maListe, name: 'Ma liste' } },
      });
    });

    it('US1-12 shows the error state and reports getCurrentList when it throws', async () => {
      const failure = new Error('read failed');
      const { store, errorReporter } = await buildStore(nothingInCart, () => ({
        getCurrentList: () => Promise.reject(failure),
      }));

      await store.getState().loadCurrentList();

      expect(store.getState().currentList).toEqual({
        status: 'error',
        error: failure,
      });
      // The reporter adds the screen shown, CurrentList (contracts/driven-ports.md).
      expect(errorReporter.reports).toEqual([
        { error: failure, context: { operation: 'getCurrentList' } },
      ]);
    });
  });

  describe('toggleItem', () => {
    it('US1-2 shows the item in the cart before its save resolves, then keeps it there', async () => {
      const { store, held, stored } = await buildHeldStore();

      const toggling = store.getState().toggleItem(lait);

      expect(shownInCart(store, lait)).toBe(true);
      expect(await stored(lait)).toBe(false);

      held.calls[0]?.release();
      await toggling;
      await settle();

      expect(shownInCart(store, lait)).toBe(true);
      expect(await stored(lait)).toBe(true);
    });

    it('US1-3 takes a ticked item out of the cart at once', async () => {
      const { store, held } = await buildHeldStore();
      const ticking = store.getState().toggleItem(lait);
      held.calls[0]?.release();
      await ticking;

      void store.getState().toggleItem(lait);

      expect(shownInCart(store, lait)).toBe(false);
    });

    it('US1-6 FR-005 moves a ticked item after the unticked ones at once', async () => {
      const { store } = await buildHeldStore();
      expect(namesShown(store)).toEqual([['Pommes'], ['Beurre', 'Lait']]);

      void store.getState().toggleItem(beurre);

      expect(namesShown(store)).toEqual([['Pommes'], ['Lait', 'Beurre']]);
    });

    it('US1-7 FR-006 FR-007 updates the remaining count and the items in the cart at once', async () => {
      const { store } = await buildHeldStore();
      expect(view(store).hasItemsInCart).toBe(false);

      void store.getState().toggleItem(lait);

      expect(view(store).remainingCount).toBe(2);
      expect(view(store).totalCount).toBe(3);
      expect(view(store).hasItemsInCart).toBe(true);
    });

    it('FR-007 has nothing in the cart again when the save of the only tick fails', async () => {
      const { store, held } = await buildHeldStore();
      const toggling = store.getState().toggleItem(lait);

      held.calls[0]?.release('fails');
      await toggling;
      await settle();

      expect(shownInCart(store, lait)).toBe(false);
      expect(view(store).hasItemsInCart).toBe(false);
      expect(view(store).remainingCount).toBe(3);
    });

    it('FR-004 R9 saves quick taps on one item one after the other, in tap order', async () => {
      const { store, held, stored, calls } = await buildHeldStore();

      void store.getState().toggleItem(lait);
      expect(shownInCart(store, lait)).toBe(true);
      void store.getState().toggleItem(lait);
      expect(shownInCart(store, lait)).toBe(false);
      void store.getState().toggleItem(lait);
      expect(shownInCart(store, lait)).toBe(true);
      await settle();

      expect(held.toggleItemInCart).toHaveBeenCalledTimes(1);

      held.calls[0]?.release();
      await settle();
      expect(held.toggleItemInCart).toHaveBeenCalledTimes(2);
      held.calls[1]?.release();
      await settle();
      expect(held.toggleItemInCart).toHaveBeenCalledTimes(3);
      held.calls[2]?.release();
      await settle();

      expect(calls).toEqual([
        `toggle ${lait}`,
        `toggle ${lait}`,
        `toggle ${lait}`,
      ]);
      expect(await stored(lait)).toBe(true);
      expect(shownInCart(store, lait)).toBe(true);
    });

    it('R9 keeps showing the taps still queued when an earlier save refreshes the list', async () => {
      const { store, held } = await buildHeldStore();

      void store.getState().toggleItem(lait);
      void store.getState().toggleItem(lait);
      await settle();
      held.calls[0]?.release();
      await settle();

      // Stored in the cart by the first tap; the second tap, still queued, took it out.
      expect(held.toggleItemInCart).toHaveBeenCalledTimes(2);
      expect(shownInCart(store, lait)).toBe(false);
      expect(view(store).hasItemsInCart).toBe(false);
    });

    it('FR-004 R9 queues toggles of other items and other writes behind the taps made before them', async () => {
      const { store, held, calls } = await buildHeldStore();

      void store.getState().toggleItem(lait);
      void store.getState().toggleItem(lait);
      void store.getState().toggleItem(pommes);
      const finishing = store.getState().finishShopping();
      await settle();
      expect(calls).toEqual([`toggle ${lait}`]);

      for (const index of [0, 1, 2]) {
        held.calls[index]?.release();
        await settle();
      }
      await finishing;

      expect(calls).toEqual([
        `toggle ${lait}`,
        `toggle ${lait}`,
        `toggle ${pommes}`,
        'finish',
      ]);
    });

    it('R9 on a failed save, drops the queued toggles of that item, shows its stored state, and reports it', async () => {
      const { store, held, stored, errorReporter, calls } =
        await buildHeldStore();

      void store.getState().toggleItem(lait); // 1: saved
      void store.getState().toggleItem(lait); // 2: fails
      void store.getState().toggleItem(lait); // 3: dropped
      void store.getState().toggleItem(pommes); // another item: still saved
      await settle();
      held.calls[0]?.release();
      await settle();
      held.calls[1]?.release('fails');
      await settle();
      held.calls[2]?.release();
      await settle();

      expect(calls).toEqual([
        `toggle ${lait}`,
        `toggle ${lait}`,
        `toggle ${pommes}`,
      ]);
      expect(held.calls).toHaveLength(3);
      // The state after tap 1, as stored.
      expect(await stored(lait)).toBe(true);
      expect(shownInCart(store, lait)).toBe(true);
      expect(await stored(pommes)).toBe(true);
      expect(shownInCart(store, pommes)).toBe(true);
      expect(store.getState().notice).toEqual({ type: 'writeFailed' });
      expect(errorReporter.reports).toEqual([
        {
          error: expect.any(Error),
          context: { operation: 'toggleItemInCart' },
        },
      ]);
    });

    it('FR-030 R12a handles a toggle failing with StorageFull the same way, with its own notice and no report', async () => {
      const { store, held, stored, errorReporter } = await buildHeldStore();

      void store.getState().toggleItem(lait); // 1: saved
      void store.getState().toggleItem(lait); // 2: storage full
      void store.getState().toggleItem(lait); // 3: dropped
      await settle();
      held.calls[0]?.release();
      await settle();
      held.calls[1]?.release('storageFull');
      await settle();

      expect(held.calls).toHaveLength(2);
      expect(await stored(lait)).toBe(true);
      expect(shownInCart(store, lait)).toBe(true);
      expect(store.getState().notice).toEqual({ type: 'storageFull' });
      expect(errorReporter.reports).toEqual([]);
    });

    it('FR-030 handles ItemNotOnList like a failed save, reported as an UnexpectedResult', async () => {
      const { store, errorReporter } = await buildStore(nothingInCart, () => ({
        toggleItemInCart: async () => err({ type: 'ItemNotOnList' as const }),
      }));
      await store.getState().loadCurrentList();

      await store.getState().toggleItem(lait);
      await settle();

      expect(shownInCart(store, lait)).toBe(false);
      expect(store.getState().notice).toEqual({ type: 'writeFailed' });
      expect(errorReporter.reports).toEqual([
        {
          error: expect.objectContaining({
            name: 'UnexpectedResult',
            code: 'ItemNotOnList',
          }),
          context: { operation: 'toggleItemInCart' },
        },
      ]);
    });
  });

  describe('finishShopping', () => {
    it('US1-8 takes every item out of the cart and shows the list reloaded', async () => {
      const { store, held, stored } = await buildHeldStore();
      void store.getState().toggleItem(lait);
      void store.getState().toggleItem(pommes);
      held.calls[0]?.release();
      await settle();
      held.calls[1]?.release();
      await settle();

      const outcome = await store.getState().finishShopping();

      expect(outcome).toEqual(ok(undefined));
      expect(items(store).map((item) => item.inCart)).toEqual([
        false,
        false,
        false,
      ]);
      expect(view(store).hasItemsInCart).toBe(false);
      expect(await stored(lait)).toBe(false);
      expect(await stored(pommes)).toBe(false);
      expect(items(store).find((i) => i.articleId === lait)?.quantity).toEqual({
        amount: 2,
        unit: 'L',
      });
    });

    it('R9a shows nothing before its save succeeds', async () => {
      let saved!: () => void;
      const { store } = await buildStore(nothingInCart, (real) => ({
        finishShopping: (listId) =>
          new Promise((resolve, reject) => {
            saved = () => real.finishShopping(listId).then(resolve, reject);
          }),
      }));
      await store.getState().loadCurrentList();
      await store.getState().toggleItem(lait);

      const finishing = store.getState().finishShopping();
      await settle();

      expect(shownInCart(store, lait)).toBe(true);
      saved();
      await finishing;
      expect(shownInCart(store, lait)).toBe(false);
    });

    it('FR-004 FR-007 runs after the toggles still queued, and is saved even when one of them fails', async () => {
      const { store, held, stored, calls } = await buildHeldStore();

      void store.getState().toggleItem(lait);
      void store.getState().toggleItem(pommes);
      const finishing = store.getState().finishShopping();
      await settle();
      held.calls[0]?.release('fails');
      await settle();
      held.calls[1]?.release();

      await expect(finishing).resolves.toEqual(ok(undefined));
      expect(calls).toEqual([`toggle ${lait}`, `toggle ${pommes}`, 'finish']);
      expect(await stored(lait)).toBe(false);
      expect(await stored(pommes)).toBe(false);
      expect(items(store).every((item) => !item.inCart)).toBe(true);
    });

    it('FR-007 succeeds with no change when the only tick failed before it, with one notice and one report', async () => {
      const { store, held, errorReporter } = await buildHeldStore();

      void store.getState().toggleItem(lait);
      expect(view(store).hasItemsInCart).toBe(true);
      const finishing = store.getState().finishShopping();
      await settle();
      held.calls[0]?.release('fails');

      await expect(finishing).resolves.toEqual(ok(undefined));
      expect(items(store).every((item) => !item.inCart)).toBe(true);
      expect(store.getState().notice).toEqual({ type: 'writeFailed' });
      expect(errorReporter.reports).toHaveLength(1);
      expect(errorReporter.reports[0]?.context).toEqual({
        operation: 'toggleItemInCart',
      });
    });

    it('FR-007 R9a changes no item when it throws, sets writeFailed and reports finishShopping', async () => {
      const failure = new Error('finish failed');
      const { store, errorReporter } = await buildStore(nothingInCart, () => ({
        finishShopping: () => Promise.reject(failure),
      }));
      await store.getState().loadCurrentList();
      await store.getState().toggleItem(lait);
      await settle();
      const before = store.getState().currentList;

      const outcome = await store.getState().finishShopping();

      expect(outcome).toEqual(err({ type: 'WriteFailed' }));
      expect(store.getState().currentList).toEqual(before);
      expect(shownInCart(store, lait)).toBe(true);
      expect(store.getState().notice).toEqual({ type: 'writeFailed' });
      expect(errorReporter.reports).toEqual([
        { error: failure, context: { operation: 'finishShopping' } },
      ]);
    });
  });
});
