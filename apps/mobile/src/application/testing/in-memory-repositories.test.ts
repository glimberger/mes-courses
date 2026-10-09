import { changeRecorderContract } from './contracts/change-recorder.contract';
import { syncStateRepositoryContract } from './contracts/sync-state.contract';
import { FakeClock } from './fake-clock';
import { SequentialIdGenerator } from './sequential-id-generator';
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
  syncStateRepositoryContract(createRepositories);
  unitOfWorkContract(
    async () => new InMemoryUnitOfWork(new InMemoryRepositories()),
  );
  changeRecorderContract(async () => {
    const clock = new FakeClock();
    return {
      clock,
      unitOfWork: new InMemoryUnitOfWork(
        new InMemoryRepositories({ clock, ids: new SequentialIdGenerator() }),
      ),
    };
  });
});
