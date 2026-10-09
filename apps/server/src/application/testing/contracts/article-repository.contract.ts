import type { ServerStore } from '../../ports/store';
import { article, category } from './entities';
import { entityRepositoryContract } from './entity-repository.contract';

export const articleRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) =>
  entityRepositoryContract(
    'Article',
    createStore,
    (repos) => repos.articles,
    (id, name, overrides) => article(id, name, 'c-1', overrides),
    async (repos) => {
      if (!(await repos.categories.get('c-1'))) {
        await repos.categories.save(category('c-1', 'Crèmerie'));
      }
    },
  );
