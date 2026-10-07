import { appStateRepositoryContract } from './contracts/app-state-repository.contract';
import { articleRepositoryContract } from './contracts/article-repository.contract';
import { categoryRepositoryContract } from './contracts/category-repository.contract';
import { listItemRepositoryContract } from './contracts/list-item-repository.contract';
import { shoppingListRepositoryContract } from './contracts/shopping-list-repository.contract';
import { unitOfWorkContract } from './contracts/unit-of-work.contract';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from './in-memory-repositories';

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
});
