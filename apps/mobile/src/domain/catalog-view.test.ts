import type { Article, ArticleId } from './article';
import {
  buildCatalogView,
  filterCatalog,
  type CatalogView,
} from './catalog-view';
import type { Category, CategoryId } from './category';
import type { ListItem } from './list-item';
import type { Quantity } from './quantity';
import type { ListId } from './shopping-list';

const maListe = 'list-1' as ListId;

const category = (id: string, name: string, position: number): Category => ({
  id: id as CategoryId,
  name,
  position,
});

const fruits = category('c-fruits', 'Fruits et légumes', 0);
const cremerie = category('c-cremerie', 'Crèmerie', 2);
const boulangerie = category('c-boulangerie', 'Boulangerie', 1);
const epicerie = category('c-epicerie', 'Épicerie salée', 3);
const boissons = category('c-boissons', 'Boissons', 4);
const categories = [cremerie, fruits, epicerie, boulangerie, boissons];

const article = (name: string, of: Category): Article => ({
  id: `a-${name}` as ArticleId,
  name,
  categoryId: of.id,
});

const pommes = article('Pommes', fruits);
const pommesDeTerre = article('Pommes de terre', fruits);
const lait = article('Lait', cremerie);
const oeufs = article('Œufs', cremerie);
const pateAmande = article('Pâte d’amande', epicerie);
const mais = article('Maïs', epicerie);
const painFrancais = article('Pain français', boulangerie);
const articles = [
  pommesDeTerre,
  lait,
  pommes,
  oeufs,
  pateAmande,
  mais,
  painFrancais,
];

const onList = (
  of: Article,
  quantity: Quantity | null = null,
  inCart = false,
): ListItem => ({ listId: maListe, articleId: of.id, inCart, quantity });

const build = (items: ListItem[] = [], from = { categories, articles }) =>
  buildCatalogView({ ...from, items });

const sectionNames = (view: CatalogView) =>
  view.sections.map((section) => section.category.name);

const articleNames = (view: CatalogView) =>
  view.sections.map((section) => section.articles.map((a) => a.name));

describe('buildCatalogView', () => {
  it('US2-15 shows every category ordered by position, empty ones included', () => {
    const view = build();

    expect(sectionNames(view)).toEqual([
      'Fruits et légumes',
      'Boulangerie',
      'Crèmerie',
      'Épicerie salée',
      'Boissons',
    ]);
    expect(view.sections[4]?.articles).toEqual([]);
  });

  it('FR-009 R11a gives each article its search form, computed when the view is built', () => {
    const view = build();

    expect(view.sections[2]?.articles).toEqual([
      {
        id: 'a-Lait',
        name: 'Lait',
        searchText: 'lait',
        onList: false,
        quantity: null,
      },
      {
        id: 'a-Œufs',
        name: 'Œufs',
        searchText: 'oeufs',
        onList: false,
        quantity: null,
      },
    ]);
  });

  it('US2-8 FR-011 marks the articles already on the target list, with their quantity there', () => {
    const view = build([onList(lait, { amount: 2, unit: 'L' }, true)]);

    expect(view.sections[2]?.articles[0]).toMatchObject({
      name: 'Lait',
      onList: true,
      quantity: { amount: 2, unit: 'L' },
    });
    expect(view.sections[2]?.articles[1]).toMatchObject({
      name: 'Œufs',
      onList: false,
      quantity: null,
    });
  });

  it('Assumptions sorts the articles of a category by name, "Pack 6" before "Pack 12"', () => {
    const pack12 = article('Pack 12', boissons);
    const pack6 = article('Pack 6', boissons);
    const eau = article('eau', boissons);
    const view = build([], {
      categories,
      articles: [pack12, eau, pack6],
    });

    expect(articleNames(view)[4]).toEqual(['eau', 'Pack 6', 'Pack 12']);
  });
});

describe('filterCatalog', () => {
  const full = build();
  const matches = (query: string) => articleNames(filterCatalog(full, query));

  it('US2-10 FR-009 finds "Pommes" and "Pommes de terre" with "pom", grouped by category', () => {
    expect(filterCatalog(full, 'pom').sections).toEqual([
      {
        category: { id: 'c-fruits', name: 'Fruits et légumes' },
        articles: [
          expect.objectContaining({ name: 'Pommes' }),
          expect.objectContaining({ name: 'Pommes de terre' }),
        ],
      },
    ]);
  });

  it('US2-10 FR-009 ignores case and accents', () => {
    expect(matches('POM')).toEqual([['Pommes', 'Pommes de terre']]);
    expect(matches('ŒUF')).toEqual([['Œufs']]);
    expect(matches('epicerie')).toEqual([]);
  });

  it('US2-10 finds "Œufs" with "oeuf" and with "œuf"', () => {
    expect(matches('oeuf')).toEqual([['Œufs']]);
    expect(matches('œuf')).toEqual([['Œufs']]);
  });

  it('FR-009 finds "Pâte d’amande" with a straight apostrophe', () => {
    expect(matches("d'amande")).toEqual([['Pâte d’amande']]);
  });

  it('FR-009 ignores the cedilla and the diaeresis like accents', () => {
    expect(matches('mais')).toEqual([['Maïs']]);
    expect(matches('francais')).toEqual([['Pain français']]);
  });

  it('FR-009 reduces inner runs of spaces in the query', () => {
    expect(matches('pommes  de')).toEqual([['Pommes de terre']]);
  });

  it('US2-14 omits the categories with no match, and has no section when nothing matches', () => {
    expect(sectionNames(filterCatalog(full, 'lait'))).toEqual(['Crèmerie']);
    expect(filterCatalog(full, 'xyz').sections).toEqual([]);
  });

  it.each(['', '   ', ' \t'])(
    'US2-10 FR-009 treats the blank query "%s" as no query: every category, empty ones included',
    (query) => {
      expect(filterCatalog(full, query)).toEqual(full);
    },
  );

  it('R11a matches on the search form the view carries, never on the name', () => {
    const view: CatalogView = {
      sections: [
        {
          category: { id: 'c-1' as CategoryId, name: 'Divers' },
          articles: [
            {
              id: 'a-1' as ArticleId,
              name: 'Lait',
              searchText: 'zzz',
              onList: false,
              quantity: null,
            },
          ],
        },
      ],
    };

    expect(articleNames(filterCatalog(view, 'zz'))).toEqual([['Lait']]);
    expect(filterCatalog(view, 'lait').sections).toEqual([]);
  });

  it('R11a keeps the order of the full view, sorting nothing again', () => {
    const unsorted: CatalogView = {
      sections: [
        {
          category: { id: 'c-2' as CategoryId, name: 'Zèbre' },
          articles: [
            {
              id: 'a-2' as ArticleId,
              name: 'Pomme Z',
              searchText: 'pomme z',
              onList: false,
              quantity: null,
            },
            {
              id: 'a-1' as ArticleId,
              name: 'Pomme A',
              searchText: 'pomme a',
              onList: false,
              quantity: null,
            },
          ],
        },
        {
          category: { id: 'c-1' as CategoryId, name: 'Abeille' },
          articles: [
            {
              id: 'a-3' as ArticleId,
              name: 'Pomme B',
              searchText: 'pomme b',
              onList: false,
              quantity: null,
            },
          ],
        },
      ],
    };

    expect(articleNames(filterCatalog(unsorted, 'pomme'))).toEqual([
      ['Pomme Z', 'Pomme A'],
      ['Pomme B'],
    ]);
  });

  it('US2-8 keeps the marks of the articles already on the list', () => {
    const view = build([onList(pommes, { amount: 1, unit: 'kg' })]);

    expect(filterCatalog(view, 'pom').sections[0]?.articles[0]).toMatchObject({
      name: 'Pommes',
      onList: true,
      quantity: { amount: 1, unit: 'kg' },
    });
  });
});
