import type { ScopedStore } from './scoped-store';
import { category } from './entities';
import { entityRepositoryContract } from './entity-repository.contract';

export const categoryRepositoryContract = (
  createStore: () => Promise<ScopedStore>,
) =>
  entityRepositoryContract(
    'Category',
    createStore,
    (repos) => repos.categories,
    category,
  );
