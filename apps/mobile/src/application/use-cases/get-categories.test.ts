import type { CategoryId } from '../../domain/category';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createGetCategories } from './get-categories';

describe('getCategories', () => {
  let unitOfWork: UnitOfWork;

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: 'c-2' as CategoryId,
        name: 'Crèmerie',
        position: 2,
      });
      await repos.categories.add({
        id: 'c-0' as CategoryId,
        name: 'Fruits et légumes',
        position: 0,
      });
      await repos.categories.add({
        id: 'c-1' as CategoryId,
        name: 'Boucherie et poissonnerie',
        position: 1,
      });
    });
  });

  it('US4-1 returns the categories ordered by position, with their id and name', async () => {
    expect(await createGetCategories({ unitOfWork })()).toEqual([
      { id: 'c-0', name: 'Fruits et légumes' },
      { id: 'c-1', name: 'Boucherie et poissonnerie' },
      { id: 'c-2', name: 'Crèmerie' },
    ]);
  });
});
