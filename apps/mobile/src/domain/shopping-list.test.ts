import { pickCurrentList, type ListId } from './shopping-list';

const list = (id: string, name: string) => ({ id: id as ListId, name });

describe('pickCurrentList', () => {
  it('picks the first list in displayed order, whatever the order given', () => {
    const lists = [
      list('l-1', 'Week-end'),
      list('l-2', 'barbecue'),
      list('l-3', 'Courses'),
    ];

    expect(pickCurrentList(lists)).toEqual(list('l-2', 'barbecue'));
  });

  it('compares numbers by value: "Liste 2" before "Liste 10"', () => {
    expect(
      pickCurrentList([list('l-1', 'Liste 10'), list('l-2', 'Liste 2')]),
    ).toEqual(list('l-2', 'Liste 2'));
  });

  it('returns null when no list is left', () => {
    expect(pickCurrentList([])).toBeNull();
  });
});
