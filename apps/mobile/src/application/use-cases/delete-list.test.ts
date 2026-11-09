import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { createDeleteList } from './delete-list';

const maListe = { id: 'l-1' as ListId, name: 'Ma liste' };
const barbecue = { id: 'l-2' as ListId, name: 'Barbecue' };
const weekEnd = { id: 'l-3' as ListId, name: 'Week-end' };
const cremerie = 'c-1' as CategoryId;
const lait = 'a-1' as ArticleId;
const beurre = 'a-2' as ArticleId;

describe('deleteList', () => {
  let unitOfWork: UnitOfWork;
  let deleteList: ReturnType<typeof createDeleteList>;
  const lists = () => unitOfWork.run((repos) => repos.lists.all());
  const itemsOf = (listId: ListId) =>
    unitOfWork.run((repos) => repos.items.forList(listId));
  const currentListId = () =>
    unitOfWork.run((repos) => repos.appState.currentListId());
  const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));
  const changes = () =>
    pending().then((all) =>
      all.map(({ kind, id, fields }) => ({ kind, id, fields })),
    );
  const item = (listId: ListId, articleId: ArticleId) => ({
    listId,
    articleId,
    inCart: false,
    quantity: null,
  });

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    deleteList = createDeleteList({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    });
    await unitOfWork.run(async (repos) => {
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
      await repos.articles.add({
        id: beurre,
        name: 'Beurre',
        categoryId: cremerie,
      });
      await repos.lists.add(maListe);
      await repos.lists.add(barbecue);
      await repos.lists.add(weekEnd);
      await repos.appState.setCurrentListId(maListe.id);
      await repos.items.save(item(maListe.id, lait));
      await repos.items.save(item(barbecue.id, lait));
      await repos.items.save(item(barbecue.id, beurre));
    });
  });

  it('US2-3 deletes a list that is not current with its items, keeping the articles, the other lists and the current list', async () => {
    expect(await deleteList(barbecue.id, 'Ma liste')).toEqual(ok(undefined));

    expect(await lists()).toEqual([maListe, weekEnd]);
    expect(await itemsOf(barbecue.id)).toEqual([]);
    expect(await itemsOf(maListe.id)).toEqual([item(maListe.id, lait)]);
    expect(await unitOfWork.run((repos) => repos.articles.all())).toHaveLength(
      2,
    );
    expect(await currentListId()).toBe(maListe.id);
  });

  it('records one list deletion, not held, so it syncs at the next cycle', async () => {
    await deleteList(barbecue.id, 'Ma liste');

    expect(await changes()).toEqual([
      { kind: 'list', id: barbecue.id, fields: { deleted: true } },
    ]);
    await unitOfWork.run((repos) => repos.changes.releaseAll());
    expect(await pending()).toHaveLength(1);
  });

  it('US2-5 makes the first remaining list by name current when deleting the current list', async () => {
    expect(await deleteList(maListe.id, 'Ma liste')).toEqual(ok(undefined));

    expect(await currentListId()).toBe(barbecue.id);
    expect(await lists()).toEqual([barbecue, weekEnd]);
    expect(await itemsOf(maListe.id)).toEqual([]);
  });

  it('US2-6 creates "Ma liste" and makes it current when deleting the last list, leaving exactly one current list', async () => {
    await deleteList(barbecue.id, 'Ma liste');
    await deleteList(weekEnd.id, 'Ma liste');

    expect(await deleteList(maListe.id, 'Ma liste')).toEqual(ok(undefined));

    const remaining = await lists();
    expect(remaining).toEqual([{ id: expect.any(String), name: 'Ma liste' }]);
    expect(remaining[0]?.id).not.toBe(maListe.id);
    expect(await currentListId()).toBe(remaining[0]?.id);
    expect(await itemsOf(remaining[0]?.id as ListId)).toEqual([]);
    expect((await changes()).slice(-2)).toEqual([
      { kind: 'list', id: maListe.id, fields: { deleted: true } },
      { kind: 'list', id: remaining[0]?.id, fields: { name: 'Ma liste' } },
    ]);
  });

  it('returns ListNotFound for an unknown list, changing and recording nothing', async () => {
    expect(await deleteList('l-9' as ListId, 'Ma liste')).toEqual(
      err({ type: 'ListNotFound' }),
    );

    expect(await lists()).toEqual([maListe, barbecue, weekEnd]);
    expect(await pending()).toEqual([]);
  });

  it('runs in one transaction: nothing changes when a storage write fails', async () => {
    const failing: UnitOfWork = {
      run: (work) =>
        unitOfWork.run((repos) =>
          work({
            ...repos,
            lists: {
              ...repos.lists,
              remove: () => Promise.reject(new Error('disk failed')),
            },
          }),
        ),
    };

    await expect(
      createDeleteList({
        unitOfWork: failing,
        ids: new SequentialIdGenerator(),
      })(maListe.id, 'Ma liste'),
    ).rejects.toThrow('disk failed');

    expect(await lists()).toEqual([maListe, barbecue, weekEnd]);
    expect(await itemsOf(maListe.id)).toEqual([item(maListe.id, lait)]);
    expect(await currentListId()).toBe(maListe.id);
    expect(await pending()).toEqual([]);
  });
});
