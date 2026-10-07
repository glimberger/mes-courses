import { appStateRepositoryContract } from './contracts/app-state-repository.contract';
import { articleRepositoryContract } from './contracts/article-repository.contract';
import { categoryRepositoryContract } from './contracts/category-repository.contract';
import { listItemRepositoryContract } from './contracts/list-item-repository.contract';
import { shoppingListRepositoryContract } from './contracts/shopping-list-repository.contract';
import { unitOfWorkContract } from './contracts/unit-of-work.contract';
import { list } from './contracts/entities';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from './in-memory-repositories';
import type { Repositories } from '../ports/unit-of-work';

describe('in-memory fakes', () => {
  const createRepositories = async () => new InMemoryRepositories();

  categoryRepositoryContract(createRepositories);
  articleRepositoryContract(createRepositories);
  shoppingListRepositoryContract(createRepositories);
  listItemRepositoryContract(createRepositories);
  appStateRepositoryContract(createRepositories);
  unitOfWorkContract(
    async () => new InMemoryUnitOfWork(new InMemoryRepositories()),
  );

  it('rejects the use of the repositories given to a run once it has ended', async () => {
    const unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    let kept: Repositories | undefined;
    await unitOfWork.run(async (repos) => {
      kept = repos;
    });

    await expect(kept?.lists.add(list('l-1', 'Ma liste'))).rejects.toThrow(
      'Repositories used after their run ended (add)',
    );
  });
});
