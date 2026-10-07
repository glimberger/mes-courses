import type { ArticleId } from './article';
import { add, changeQuantity, toggle, type ListItem } from './list-item';
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

describe('add', () => {
  const target = { listId: 'list-1' as ListId, articleId: 'lait' as ArticleId };

  it('US2-1 FR-012 FR-014 adds an unticked item with no quantity', () => {
    expect(add(null, target, null)).toEqual({
      ok: true,
      value: item('lait', false),
    });
  });

  it('US2-2 FR-013 adds an unticked item with the given quantity', () => {
    const quantity = { amount: 1.5, unit: 'kg' };

    expect(add(null, target, quantity)).toEqual({
      ok: true,
      value: item('lait', false, quantity),
    });
  });

  it('FR-011 refuses an article already on the list with AlreadyOnList, carrying its current quantity', () => {
    const onList = item('lait', true, { amount: 2, unit: 'L' });

    expect(add(onList, target, { amount: 1, unit: null })).toEqual({
      ok: false,
      error: { type: 'AlreadyOnList', quantity: { amount: 2, unit: 'L' } },
    });
  });
});

describe('changeQuantity', () => {
  it('US2-3 FR-015 sets the quantity, keeping the tick', () => {
    expect(
      changeQuantity(item('lait', true, { amount: 1, unit: 'L' }), {
        amount: 2,
        unit: 'L',
      }),
    ).toEqual(item('lait', true, { amount: 2, unit: 'L' }));
  });

  it('US2-4 FR-015 clears the quantity, keeping the tick', () => {
    expect(
      changeQuantity(item('lait', false, { amount: 1, unit: 'L' }), null),
    ).toEqual(item('lait', false));
  });
});
