import { normalizedName } from '../../../domain/name';
import type { Repositories } from '../../ports/unit-of-work';
import {
  article,
  articleId,
  category,
  categoryId,
  item,
  list,
} from './entities';

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

    it('returns every article added, in the order they were added', async () => {
      await repos.articles.add(article('a-2', 'Pommes', 'c-2'));
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));

      expect(await repos.articles.all()).toEqual([
        article('a-2', 'Pommes', 'c-2'),
        article('a-1', 'Lait', 'c-1'),
      ]);
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

    it('updates the name, the normalized name and the category', async () => {
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));

      await repos.articles.update(article('a-1', 'Œufs', 'c-2'));

      expect(await repos.articles.findById(articleId('a-1'))).toEqual(
        article('a-1', 'Œufs', 'c-2'),
      );
      expect(
        await repos.articles.findByNormalizedName(normalizedName('oeufs')),
      ).toEqual(article('a-1', 'Œufs', 'c-2'));
      expect(
        await repos.articles.findByNormalizedName(normalizedName('Lait')),
      ).toBeNull();
    });

    it('removes an article', async () => {
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));
      await repos.articles.add(article('a-2', 'Pommes', 'c-2'));

      await repos.articles.remove(articleId('a-1'));

      expect(await repos.articles.all()).toEqual([
        article('a-2', 'Pommes', 'c-2'),
      ]);
    });

    it('rejects removing an article while a list item still refers to it', async () => {
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));
      await repos.lists.add(list('l-1', 'Ma liste'));
      await repos.items.save(item('l-1', 'a-1'));

      await expect(repos.articles.remove(articleId('a-1'))).rejects.toThrow();

      expect(await repos.articles.findById(articleId('a-1'))).toEqual(
        article('a-1', 'Lait', 'c-1'),
      );
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
