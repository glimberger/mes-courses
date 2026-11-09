import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import type { ListId } from '../../domain/shopping-list';
import { SEED_DEVICE_ID } from '../ports/sync-state';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { resolveCurrentList } from './resolve-current-list';

const maListe = { id: 'l-1' as ListId, name: 'Ma liste' };
const weekEnd = { id: 'l-2' as ListId, name: 'Week-end' };
const barbecue = { id: 'l-3' as ListId, name: 'barbecue' };
const lait = 'a-1' as ArticleId;

describe('resolveCurrentList', () => {
  let unitOfWork: UnitOfWork;
  const currentListId = () =>
    unitOfWork.run((repos) => repos.appState.currentListId());
  const lists = () => unitOfWork.run((repos) => repos.lists.all());
  const pending = () =>
    unitOfWork
      .run((repos) => repos.changes.pending(100))
      .then((changes) =>
        changes.map(({ kind, id, fields }) => ({ kind, id, fields })),
      );
  const resolve = (
    removing: ListId,
    incoming: { id: ListId; name: string }[] = [],
  ) =>
    unitOfWork.run((repos) =>
      resolveCurrentList(repos, new SequentialIdGenerator(), {
        removing,
        incoming,
        firstListName: 'Ma liste',
      }),
    );
  const keepOnly = (id: ListId) =>
    unitOfWork.run(async (repos) => {
      for (const list of await repos.lists.all()) {
        if (list.id !== id) await repos.lists.remove(list.id);
      }
    });

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: 'c-1' as CategoryId,
        name: 'Crèmerie',
        position: 0,
      });
      await repos.articles.add({
        id: lait,
        name: 'Lait',
        categoryId: 'c-1' as CategoryId,
      });
      await repos.lists.add(maListe);
      await repos.lists.add(weekEnd);
      await repos.lists.add(barbecue);
      await repos.appState.setCurrentListId(maListe.id);
      await repos.items.save({
        listId: maListe.id,
        articleId: lait,
        inCart: false,
        quantity: null,
      });
    });
  });

  it('makes the first remaining list by name current, then removes the current list and its items', async () => {
    expect(await resolve(maListe.id)).toBeNull();

    expect(await currentListId()).toBe(barbecue.id);
    expect(await lists()).toEqual([weekEnd, barbecue]);
    expect(
      await unitOfWork.run((repos) => repos.items.forList(maListe.id)),
    ).toEqual([]);
    expect(await pending()).toEqual([]);
  });

  it('removes a list that is not current, leaving the current list as it is', async () => {
    await resolve(weekEnd.id);

    expect(await currentListId()).toBe(maListe.id);
    expect(await lists()).toEqual([maListe, barbecue]);
  });

  it('replaces the last list with a list named firstListName, recorded and current, even when the removed one has that name', async () => {
    await keepOnly(maListe.id);

    expect(await resolve(maListe.id)).toBeNull();

    expect(await lists()).toEqual([{ id: 'id-1', name: 'Ma liste' }]);
    expect(await currentListId()).toBe('id-1');
    expect(await pending()).toEqual([
      { kind: 'list', id: 'id-1', fields: { name: 'Ma liste' } },
    ]);
  });

  it('records the new list as a normal change, not a seed', async () => {
    await keepOnly(maListe.id);

    await resolve(maListe.id);

    const [change] = await unitOfWork.run((repos) => repos.changes.pending(1));
    expect(change?.hlc.deviceId).not.toBe(SEED_DEVICE_ID);
  });

  it('counts incoming live lists as remaining: no default list, the incoming one is returned to make current once stored', async () => {
    await keepOnly(maListe.id);
    const courses = { id: 'l-9' as ListId, name: 'Courses' };

    expect(await resolve(maListe.id, [courses])).toBe(courses.id);

    expect(await lists()).toEqual([]);
    expect(await currentListId()).toBeNull();
    expect(await pending()).toEqual([]);
  });

  it('prefers a remaining local list over an incoming one, which cannot be current before it is stored', async () => {
    const aperitif = { id: 'l-9' as ListId, name: 'Apéritif' };

    expect(await resolve(maListe.id, [aperitif])).toBeNull();

    expect(await currentListId()).toBe(barbecue.id);
  });

  it('does nothing for an unknown list', async () => {
    expect(await resolve('l-404' as ListId)).toBeNull();

    expect(await lists()).toEqual([maListe, weekEnd, barbecue]);
    expect(await currentListId()).toBe(maListe.id);
  });
});
