import { normalizedName } from '../../../domain/name';
import type { Repositories } from '../../ports/unit-of-work';
import { category, categoryId } from './entities';

export const categoryRepositoryContract = (
  createRepositories: () => Promise<Repositories>,
) => {
  describe('CategoryRepository contract', () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await createRepositories();
    });

    it('has no category at first', async () => {
      expect(await repos.categories.all()).toEqual([]);
    });

    it('returns every category ordered by position, whatever the order they were added in', async () => {
      await repos.categories.add(category('c-2', 'Crèmerie', 2));
      await repos.categories.add(category('c-0', 'Fruits et légumes', 0));
      await repos.categories.add(
        category('c-1', 'Boucherie et poissonnerie', 1),
      );

      expect(await repos.categories.all()).toEqual([
        category('c-0', 'Fruits et légumes', 0),
        category('c-1', 'Boucherie et poissonnerie', 1),
        category('c-2', 'Crèmerie', 2),
      ]);
    });

    it('finds a category by id, or null', async () => {
      await repos.categories.add(category('c-1', 'Crèmerie', 0));

      expect(await repos.categories.findById(categoryId('c-1'))).toEqual(
        category('c-1', 'Crèmerie', 0),
      );
      expect(await repos.categories.findById(categoryId('unknown'))).toBeNull();
    });

    it('finds a category by its normalized name, or null', async () => {
      await repos.categories.add(category('c-1', 'Épicerie salée', 0));

      expect(
        await repos.categories.findByNormalizedName(
          normalizedName(' ÉPICERIE  salée'),
        ),
      ).toEqual(category('c-1', 'Épicerie salée', 0));
      expect(
        await repos.categories.findByNormalizedName(
          normalizedName('Epicerie salée'),
        ),
      ).toBeNull();
    });

    it('gives 0 as the next position when there is no category', async () => {
      expect(await repos.categories.nextPosition()).toBe(0);
    });

    it('gives the highest position plus one as the next position', async () => {
      await repos.categories.add(category('c-1', 'Crèmerie', 0));
      await repos.categories.add(category('c-2', 'Divers', 10));

      expect(await repos.categories.nextPosition()).toBe(11);
    });

    it('rejects a category whose id, normalized name or position is taken, keeping the first', async () => {
      await repos.categories.add(category('c-1', 'Crèmerie', 0));

      await expect(
        repos.categories.add(category('c-1', 'Divers', 1)),
      ).rejects.toThrow();
      await expect(
        repos.categories.add(category('c-2', ' CRÈMERIE ', 1)),
      ).rejects.toThrow();
      await expect(
        repos.categories.add(category('c-2', 'Divers', 0)),
      ).rejects.toThrow();

      expect(await repos.categories.all()).toEqual([
        category('c-1', 'Crèmerie', 0),
      ]);
    });

    it('keeps copies: changing an added or returned category changes nothing stored', async () => {
      const added = category('c-1', 'Crèmerie', 0);
      await repos.categories.add(added);
      added.name = 'Changed';

      const [found] = await repos.categories.all();
      if (found) found.position = 9;

      expect(await repos.categories.findById(categoryId('c-1'))).toEqual(
        category('c-1', 'Crèmerie', 0),
      );
    });
  });
};
