import type { Article, ArticleId } from './article';
import type { Category, CategoryId } from './category';
import { buildCurrentListView } from './current-list-view';
import type { ListItem } from './list-item';
import type { Quantity } from './quantity';
import type { ListId, ShoppingList } from './shopping-list';

const list: ShoppingList = { id: 'list-1' as ListId, name: 'Ma liste' };

const category = (id: string, name: string, position: number): Category => ({
  id: id as CategoryId,
  name,
  position,
});

const fruits = category('c-fruits', 'Fruits et légumes', 0);
const cremerie = category('c-cremerie', 'Crèmerie', 2);
const boulangerie = category('c-boulangerie', 'Boulangerie', 1);
const surgeles = category('c-surgeles', 'Surgelés', 3);

const article = (name: string, of: Category): Article => ({
  id: `a-${name}` as ArticleId,
  name,
  categoryId: of.id,
});

const item = (
  of: Article,
  inCart = false,
  quantity: Quantity | null = null,
): ListItem => ({ listId: list.id, articleId: of.id, inCart, quantity });

const lait = article('Lait', cremerie);
const beurre = article('Beurre', cremerie);
const pommes = article('Pommes', fruits);
const baguette = article('Baguette', boulangerie);
const glace = article('Glace', surgeles);
const articles = [lait, beurre, pommes, baguette, glace];
const categories = [fruits, boulangerie, cremerie, surgeles];

const build = (items: ListItem[], from = { categories, articles }) =>
  buildCurrentListView({ list, items, ...from });

const sectionNames = (view: ReturnType<typeof build>) =>
  view.sections.map((section) => section.category.name);

const itemNames = (view: ReturnType<typeof build>) =>
  view.sections.map((section) => section.items.map((i) => i.name));

describe('buildCurrentListView', () => {
  it('US1-1 names the list and shows each item with its name, tick and quantity', () => {
    const view = build([item(lait, false, { amount: 2, unit: 'L' })]);

    expect(view.list).toEqual({ id: 'list-1', name: 'Ma liste' });
    expect(view.sections).toEqual([
      {
        category: { id: 'c-cremerie', name: 'Crèmerie' },
        items: [
          {
            articleId: 'a-Lait',
            name: 'Lait',
            inCart: false,
            quantity: { amount: 2, unit: 'L' },
          },
        ],
      },
    ]);
  });

  it('FR-003 orders the sections by category position, not by the order of the items', () => {
    const view = build([item(lait), item(pommes), item(baguette)]);

    expect(sectionNames(view)).toEqual([
      'Fruits et légumes',
      'Boulangerie',
      'Crèmerie',
    ]);
  });

  it('US4-5 FR-003 shows no section for a category holding no item of the list', () => {
    const view = build([item(lait), item(glace)]);

    expect(sectionNames(view)).toEqual(['Crèmerie', 'Surgelés']);
  });

  it('US1-10 has no section for a list with no item', () => {
    const view = build([]);

    expect(view.sections).toEqual([]);
    expect(view.totalCount).toBe(0);
    expect(view.remainingCount).toBe(0);
    expect(view.hasItemsInCart).toBe(false);
  });

  it('US1-6 FR-005 puts unticked items before ticked items within a category', () => {
    const view = build([item(beurre, true), item(lait, false)]);

    expect(itemNames(view)).toEqual([['Lait', 'Beurre']]);
  });

  it('US1-6 FR-005 sorts each group by name with the French collation', () => {
    const creme = article('Crème fraîche', cremerie);
    const oeufs = article('Œufs', cremerie);
    const yaourt = article('yaourt', cremerie);
    const view = build(
      [
        item(yaourt, true),
        item(lait),
        item(oeufs),
        item(beurre, true),
        item(creme),
      ],
      { categories, articles: [...articles, creme, oeufs, yaourt] },
    );

    expect(itemNames(view)).toEqual([
      ['Crème fraîche', 'Lait', 'Œufs', 'Beurre', 'yaourt'],
    ]);
  });

  it('Assumptions sorts "Lait 2 L" before "Lait 10 L", comparing numbers by value', () => {
    const lait10 = article('Lait 10 L', cremerie);
    const lait2 = article('Lait 2 L', cremerie);
    const view = build([item(lait10), item(lait2)], {
      categories,
      articles: [lait10, lait2],
    });

    expect(itemNames(view)).toEqual([['Lait 2 L', 'Lait 10 L']]);
  });

  it('US1-7 FR-006 counts the unticked items as remaining: 5 items with 2 ticked leave 3', () => {
    const view = build([
      item(lait, true),
      item(beurre),
      item(pommes, true),
      item(baguette),
      item(glace),
    ]);

    expect(view.remainingCount).toBe(3);
    expect(view.totalCount).toBe(5);
  });

  it('US1-7 FR-006 counts no item remaining when everything is in the cart', () => {
    const view = build([item(lait, true), item(pommes, true)]);

    expect(view.remainingCount).toBe(0);
    expect(view.totalCount).toBe(2);
  });

  it('FR-007 has items in the cart as soon as one item is ticked', () => {
    expect(build([item(lait), item(pommes, true)]).hasItemsInCart).toBe(true);
  });

  it('FR-007 has no item in the cart when nothing is ticked', () => {
    expect(build([item(lait), item(pommes)]).hasItemsInCart).toBe(false);
  });
});
