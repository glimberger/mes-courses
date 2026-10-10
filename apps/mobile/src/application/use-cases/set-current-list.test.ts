import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createGetCurrentList } from './get-current-list';
import { createSetCurrentList } from './set-current-list';
import { createToggleItemInCart } from './toggle-item-in-cart';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const lait = 'a-1' as ArticleId;

describe('setCurrentList', () => {
  let repositories: InMemoryRepositories;
  let unitOfWork: UnitOfWork;
  const currentListId = () =>
    unitOfWork.run((repos) => repos.appState.currentListId());

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    unitOfWork = new InMemoryUnitOfWork(repositories);
    await unitOfWork.run(async (repos) => {
      const cremerie = 'c-1' as CategoryId;
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 0,
      });
      await repos.articles.add({
        id: lait,
        name: 'Lait',
        categoryId: cremerie,
      });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      for (const listId of [maListe, barbecue]) {
        await repos.items.save({
          listId,
          articleId: lait,
          inCart: false,
          quantity: null,
        });
      }
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US3-3 FR-025 makes the list current, and the choice is kept for the next opening', async () => {
    const outcome = await createSetCurrentList({ unitOfWork })(barbecue);

    expect(outcome).toEqual(ok(undefined));
    expect(await currentListId()).toBe(barbecue);
    // Another opening: new use cases on the same storage.
    const reopened = new InMemoryUnitOfWork(repositories);
    expect(
      (await createGetCurrentList({ unitOfWork: reopened })()).list,
    ).toEqual({ id: barbecue, name: 'Barbecue' });
  });

  it('returns ListNotFound for an unknown list, keeping the current one', async () => {
    const outcome = await createSetCurrentList({ unitOfWork })(
      'l-unknown' as ListId,
    );

    expect(outcome).toEqual(err({ type: 'ListNotFound' }));
    expect(await currentListId()).toBe(maListe);
  });

  it('US3-4 FR-026 ticking "Lait" on one list leaves it unticked on the other', async () => {
    await createToggleItemInCart({ unitOfWork })(maListe, lait);

    await createSetCurrentList({ unitOfWork })(barbecue);
    const barbecueView = await createGetCurrentList({ unitOfWork })();
    await createSetCurrentList({ unitOfWork })(maListe);
    const maListeView = await createGetCurrentList({ unitOfWork })();

    expect(barbecueView.sections[0]?.items[0]).toMatchObject({
      name: 'Lait',
      inCart: false,
    });
    expect(maListeView.sections[0]?.items[0]).toMatchObject({
      name: 'Lait',
      inCart: true,
    });
  });

  describe('recorded changes (FR-015)', () => {
    it('records nothing: the current list is per device', async () => {
      await createSetCurrentList({ unitOfWork })(barbecue);

      expect(
        await unitOfWork.run((repos) => repos.changes.pending(100)),
      ).toEqual([]);
    });
  });
});
