import type { ServerStore } from '../../ports/store';
import { category } from './entities';
import { entityRepositoryContract } from './entity-repository.contract';

export const categoryRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) =>
  entityRepositoryContract(
    'Category',
    createStore,
    (repos) => repos.categories,
    category,
  );
