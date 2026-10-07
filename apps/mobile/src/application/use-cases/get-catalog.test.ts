import type { ArticleId } from '../../domain/article';
import { filterCatalog } from '../../domain/catalog-view';
import type { CategoryId } from '../../domain/category';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createGetCatalog } from './get-catalog';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const fruits = 'c-1' as CategoryId;
const cremerie = 'c-2' as CategoryId;
const boissons = 'c-3' as CategoryId;
const lait = 'a-1' as ArticleId;
const pommes = 'a-2' as ArticleId;
const pommesDeTerre = 'a-3' as ArticleId;

describe('getCatalog', () => {
  let unitOfWork: UnitOfWork;

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 1,
      });
      await repos.categories.add({
        id: fruits,
        name: 'Fruits et légumes',
        position: 0,
      });
      await repos.categories.add({
        id: boissons,
        name: 'Boissons',
        position: 2,
      });
      await repos.articles.add({
        id: pommesDeTerre,
        name: 'Pommes de terre',
        categoryId: fruits,
      });
      await repos.articles.add({
        id: lait,
        name: 'Lait',
        categoryId: cremerie,
      });
      await repos.articles.add({
        id: pommes,
        name: 'Pommes',
        categoryId: fruits,
      });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      await repos.items.save({
        listId: maListe,
        articleId: lait,
        inCart: true,
        quantity: { amount: 2, unit: 'L' },
      });
      await repos.items.save({
        listId: barbecue,
        articleId: pommes,
        inCart: false,
        quantity: null,
      });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US2-15 FR-008 returns every category in order, its articles by name, marking those on the given list', async () => {
    const view = await createGetCatalog({ unitOfWork })(maListe);

    expect(view).toEqual({
      sections: [
        {
          category: { id: fruits, name: 'Fruits et légumes' },
          articles: [
            {
              id: pommes,
              name: 'Pommes',
              searchText: 'pommes',
              onList: false,
              quantity: null,
            },
            {
              id: pommesDeTerre,
              name: 'Pommes de terre',
              searchText: 'pommes de terre',
              onList: false,
              quantity: null,
            },
          ],
        },
        {
          category: { id: cremerie, name: 'Crèmerie' },
          articles: [
            {
              id: lait,
              name: 'Lait',
              searchText: 'lait',
              onList: true,
              quantity: { amount: 2, unit: 'L' },
            },
          ],
        },
        { category: { id: boissons, name: 'Boissons' }, articles: [] },
      ],
    });
  });

  it('US2-5 FR-011 marks the articles of the given list only', async () => {
    const view = await createGetCatalog({ unitOfWork })(barbecue);

    const marked = view.sections
      .flatMap((section) => section.articles)
      .filter((article) => article.onList)
      .map((article) => article.name);
    expect(marked).toEqual(['Pommes']);
  });

  it.each(['pom', 'POM', '  lait ', 'xyz', '   '])(
    'R11a FR-009 with the query "%s", returns the full view filtered by filterCatalog',
    async (query) => {
      const getCatalog = createGetCatalog({ unitOfWork });

      expect(await getCatalog(maListe, query)).toEqual(
        filterCatalog(await getCatalog(maListe), query),
      );
    },
  );
});
