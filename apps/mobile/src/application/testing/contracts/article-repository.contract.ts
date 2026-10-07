import { normalizedName } from '../../../domain/name';
import type { Repositories } from '../../ports/unit-of-work';
import { article, articleId, category, categoryId } from './entities';

export const articleRepositoryContract = (
  createRepositories: () => Promise<Repositories>,
) => {
  describe('ArticleRepository contract', () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await createRepositories();
      await repos.categories.add(category('c-1', 'Crèmerie', 0));
      await repos.categories.add(category('c-2', 'Fruits et légumes', 1));
    });

    it('has no article at first', async () => {
      expect(await repos.articles.all()).toEqual([]);
    });

    it('returns every article added', async () => {
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));
      await repos.articles.add(article('a-2', 'Pommes', 'c-2'));

      const all = await repos.articles.all();
      expect(all).toHaveLength(2);
      expect(all).toEqual(
        expect.arrayContaining([
          article('a-1', 'Lait', 'c-1'),
          article('a-2', 'Pommes', 'c-2'),
        ]),
      );
    });

    it('finds an article by id, or null', async () => {
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));

      expect(await repos.articles.findById(articleId('a-1'))).toEqual(
        article('a-1', 'Lait', 'c-1'),
      );
      expect(await repos.articles.findById(articleId('unknown'))).toBeNull();
    });

    it('finds an article by its normalized name, or null', async () => {
      await repos.articles.add(article('a-1', 'Œufs', 'c-1'));

      expect(
        await repos.articles.findByNormalizedName(normalizedName('oeufs')),
      ).toEqual(article('a-1', 'Œufs', 'c-1'));
      expect(
        await repos.articles.findByNormalizedName(normalizedName('Œuf')),
      ).toBeNull();
    });

    it('rejects an article whose id or normalized name is taken, keeping the first', async () => {
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));

      await expect(
        repos.articles.add(article('a-1', 'Pommes', 'c-2')),
      ).rejects.toThrow();
      await expect(
        repos.articles.add(article('a-2', 'LAIT', 'c-2')),
      ).rejects.toThrow();

      expect(await repos.articles.all()).toEqual([
        article('a-1', 'Lait', 'c-1'),
      ]);
    });

    it('rejects an article in a category that does not exist', async () => {
      await expect(
        repos.articles.add(article('a-1', 'Lait', 'unknown')),
      ).rejects.toThrow();

      expect(await repos.articles.all()).toEqual([]);
    });

    it('keeps copies: changing an added or returned article changes nothing stored', async () => {
      const added = article('a-1', 'Lait', 'c-1');
      await repos.articles.add(added);
      added.name = 'Changed';

      const [found] = await repos.articles.all();
      if (found) found.categoryId = categoryId('c-2');

      expect(await repos.articles.findById(articleId('a-1'))).toEqual(
        article('a-1', 'Lait', 'c-1'),
      );
    });
  });
};
