import type { ArticleId } from './article';
import { finish, toggle, type ListItem } from './list-item';
import type { ListId } from './shopping-list';

const item = (
  articleId: string,
  inCart: boolean,
  quantity: ListItem['quantity'] = null,
): ListItem => ({
  listId: 'list-1' as ListId,
  articleId: articleId as ArticleId,
  inCart,
  quantity,
});

describe('toggle', () => {
  it('US1-2 puts an item that is not in the cart into it', () => {
    expect(toggle(item('lait', false))).toEqual(item('lait', true));
  });

  it('US1-3 takes an item in the cart out of it', () => {
    expect(toggle(item('lait', true))).toEqual(item('lait', false));
  });

  it('keeps the quantity of the item', () => {
    const quantity = { amount: 2, unit: 'L' };

    expect(toggle(item('lait', false, quantity))).toEqual(
      item('lait', true, quantity),
    );
  });
});

describe('finish', () => {
  it('US1-8 takes every item out of the cart, keeping every item and its quantity', () => {
    const items = [
      item('lait', true, { amount: 2, unit: 'L' }),
      item('pommes', false),
      item('farine', true, { amount: 1.5, unit: 'kg' }),
    ];

    expect(finish(items)).toEqual([
      item('lait', false, { amount: 2, unit: 'L' }),
      item('pommes', false),
      item('farine', false, { amount: 1.5, unit: 'kg' }),
    ]);
  });

  it('FR-007 succeeds and changes nothing on a list with nothing in the cart', () => {
    const items = [item('lait', false), item('pommes', false)];

    expect(finish(items)).toEqual(items);
  });

  it('FR-007 succeeds on a list with no item', () => {
    expect(finish([])).toEqual([]);
  });
});
