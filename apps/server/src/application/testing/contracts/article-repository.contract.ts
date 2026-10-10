import type { ServerStore } from '../../ports/store';
import { article, category, hlc } from './entities';
import { entityRepositoryContract } from './entity-repository.contract';

export const articleRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) =>
  entityRepositoryContract(
    'Article',
    createStore,
    (repos) => repos.articles,
    (id, name, overrides) => article(id, name, 'c-1', overrides),
    async (repos) => {
      if (!(await repos.categories.get('c-1'))) {
        await repos.categories.save(category('c-1', 'Crèmerie'));
      }
    },
  );

export const articleInCategoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('ArticleRepository.inCategory contract', () => {
    it('lists the articles of a category, live ones and tombstones, by id', async () => {
      const store = await createStore();
      await store.run(async ({ categories, articles }) => {
        await categories.save(category('c-1', 'Crèmerie'));
        await categories.save(category('c-2', 'Boissons'));
        await articles.save(article('a-2', 'Lait', 'c-1'));
        await articles.save(article('a-1', 'Beurre', 'c-1'));
        await articles.save(article('a-3', 'Eau', 'c-2'));
        await articles.save(
          article('a-4', 'Crème', 'c-1', { deletedHlc: hlc(5) }),
        );
      });

      await store.run(async ({ articles }) => {
        expect((await articles.inCategory('c-1')).map((a) => a.id)).toEqual([
          'a-1',
          'a-2',
          'a-4',
        ]);
        expect(await articles.inCategory('c-9')).toEqual([]);
      });
    });
  });
};
