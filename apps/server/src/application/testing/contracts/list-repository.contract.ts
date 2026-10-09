import type { ServerStore } from '../../ports/store';
import { list } from './entities';
import { entityRepositoryContract } from './entity-repository.contract';

export const listRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) =>
  entityRepositoryContract('List', createStore, (repos) => repos.lists, list);
