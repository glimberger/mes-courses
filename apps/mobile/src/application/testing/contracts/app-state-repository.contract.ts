import type { Repositories } from '../../ports/unit-of-work';
import { list, listId } from './entities';

export const appStateRepositoryContract = (
  createRepositories: () => Promise<Repositories>,
) => {
  describe('AppStateRepository contract', () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await createRepositories();
      await repos.lists.add(list('l-1', 'Ma liste'));
      await repos.lists.add(list('l-2', 'Barbecue'));
    });

    it('has no current list before one is set', async () => {
      expect(await repos.appState.currentListId()).toBeNull();
    });

    it('keeps the current list that was set', async () => {
      await repos.appState.setCurrentListId(listId('l-1'));

      expect(await repos.appState.currentListId()).toBe('l-1');
    });

    it('replaces the current list when another is set', async () => {
      await repos.appState.setCurrentListId(listId('l-1'));
      await repos.appState.setCurrentListId(listId('l-2'));

      expect(await repos.appState.currentListId()).toBe('l-2');
    });
  });
};
