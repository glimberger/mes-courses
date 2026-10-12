import type { ScopedStore } from './scoped-store';
import { list } from './entities';
import { entityRepositoryContract } from './entity-repository.contract';

export const listRepositoryContract = (
  createStore: () => Promise<ScopedStore>,
) =>
  entityRepositoryContract('List', createStore, (repos) => repos.lists, list);
