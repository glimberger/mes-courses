/** @jest-environment node */
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../application/testing/in-memory-repositories';
import { SequentialIdGenerator } from '../application/testing/sequential-id-generator';
import { filterCatalog } from '../domain/catalog-view';
import { normalizedName } from '../domain/name';
import type { ListId } from '../domain/shopping-list';
import { seed } from '../adapters/ui/seed';
import { createUseCases } from '../adapters/ui/use-cases';
import { seedForMeasurement } from './measurement-seed';

/** A first launch's store, as `composeApp` leaves it before the measurement seed. */
const freshStore = async () => {
  const unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
  const useCases = createUseCases({
    unitOfWork,
    ids: new SequentialIdGenerator(),
  });
  await useCases.initializeStore(seed);
  return { unitOfWork, useCases };
};

type Store = Awaited<ReturnType<typeof freshStore>>;

const contents = ({ unitOfWork }: Store) =>
  unitOfWork.run(async (repos) => {
    const lists = await repos.lists.all();
    return {
      articles: await repos.articles.all(),
      lists,
      current: await repos.appState.currentListId(),
      items: new Map(
        await Promise.all(
          lists.map(
            async (list) =>
              [list.id, await repos.items.forList(list.id)] as const,
          ),
        ),
      ),
    };
  });

const length = (name: string) => [...name].length;

describe('seedForMeasurement', () => {
  describe('with 200 items', () => {
    let store: Store;
    let stored: Awaited<ReturnType<typeof contents>>;

    beforeAll(async () => {
      store = await freshStore();
      await seedForMeasurement(store.useCases, '200');
      stored = await contents(store);
    }, 30_000);

    it('creates 1 000 articles with unique names', () => {
      expect(stored.articles).toHaveLength(1000);
      expect(
        new Set(stored.articles.map((article) => normalizedName(article.name)))
          .size,
      ).toBe(1000);
    });

    it('FR-022 makes 100 names exactly 60 characters long, and none longer', () => {
      const lengths = stored.articles.map((article) => length(article.name));

      expect(lengths.filter((size) => size === 60)).toHaveLength(100);
      expect(Math.max(...lengths)).toBe(60);
    });

    it('lengthens names by appending whole words to a variant', () => {
      const long = stored.articles.filter(
        (article) => length(article.name) === 60,
      );

      for (const { name } of long) {
        expect(name).toMatch(/^\S.* \d+( \S+)+$/u);
      }
    });

    it('keeps the plain names quickstart step 15 searches', () => {
      const names = stored.articles.map((article) => article.name);

      expect(names).toEqual(
        expect.arrayContaining(['Pommes', 'Lait demi-écrémé', 'Farine de blé']),
      );
    });

    it('spreads the articles over the 11 default categories', () => {
      expect(
        new Set(stored.articles.map((article) => article.categoryId)).size,
      ).toBe(11);
    });

    it('creates 20 lists, "Ma liste" current and "Liste 2" to "Liste 20"', () => {
      const names = stored.lists.map((list) => list.name);

      expect(names).toHaveLength(20);
      expect(names).toEqual(
        expect.arrayContaining([
          'Ma liste',
          ...Array.from({ length: 19 }, (_, at) => `Liste ${at + 2}`),
        ]),
      );
      expect(
        stored.lists.find((list) => list.id === stored.current)?.name,
      ).toBe('Ma liste');
    });

    it('puts 200 items on the current list: 100 ticked, 100 with "2 kg", 50 both', () => {
      const items = stored.items.get(stored.current as ListId) ?? [];
      const ticked = items.filter((item) => item.inCart);
      const withQuantity = items.filter((item) => item.quantity !== null);

      expect(items).toHaveLength(200);
      expect(ticked).toHaveLength(100);
      expect(withQuantity).toHaveLength(100);
      expect(withQuantity.every((item) => item.quantity?.amount === 2)).toBe(
        true,
      );
      expect(withQuantity.every((item) => item.quantity?.unit === 'kg')).toBe(
        true,
      );
      expect(ticked.filter((item) => item.quantity !== null)).toHaveLength(50);
    });

    it('puts 50 unticked items with no quantity on each other list', () => {
      for (const list of stored.lists) {
        if (list.id === stored.current) continue;
        const items = stored.items.get(list.id) ?? [];
        expect(items).toHaveLength(50);
        expect(
          items.every((item) => !item.inCart && item.quantity === null),
        ).toBe(true);
      }
    });

    it('SC-011 finds at least 10 articles when searching "pom"', async () => {
      const view = await store.useCases.getCatalog(stored.current as ListId);

      const found = filterCatalog(view, 'pom').sections.flatMap(
        (section) => section.articles,
      );

      expect(found.length).toBeGreaterThanOrEqual(10);
    });
  });

  it.each([undefined, '', '0', '-5', 'abc', '2.5'])(
    'is ignored with %p',
    async (value) => {
      const store = await freshStore();

      await seedForMeasurement(store.useCases, value);

      expect((await contents(store)).articles).toEqual([]);
    },
  );

  it('is ignored when the store already holds an article', async () => {
    const store = await freshStore();
    const before = await contents(store);
    const listId = before.current as ListId;
    const [category] = await store.useCases.getCategories();
    if (!category) throw new Error('No category');
    await store.useCases.createArticleAndAddToList(
      listId,
      { name: 'Lait', categoryId: category.id },
      null,
    );

    await seedForMeasurement(store.useCases, '200');

    const after = await contents(store);
    expect(after.articles.map((article) => article.name)).toEqual(['Lait']);
    expect(after.lists).toHaveLength(1);
  });

  it('with fewer items than a list holds, still creates the whole catalog', async () => {
    const store = await freshStore();

    await seedForMeasurement(store.useCases, '3');

    const stored = await contents(store);
    expect(stored.articles).toHaveLength(1000);
    expect(stored.items.get(stored.current as ListId)).toHaveLength(3);
  }, 30_000);
});
