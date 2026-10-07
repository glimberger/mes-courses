import type { ArticleId } from './article';
import { toggle, type ListItem } from './list-item';
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
