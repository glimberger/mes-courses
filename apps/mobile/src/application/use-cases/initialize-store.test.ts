import type { CategoryId } from '../../domain/category';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { createInitializeStore } from './initialize-store';

const seed = {
  categoryNames: ['Fruits et légumes', 'Crèmerie', 'Boulangerie'],
  firstListName: 'Ma liste',
};

describe('initializeStore', () => {
  let unitOfWork: UnitOfWork;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    ids = new SequentialIdGenerator();
  });

  it('US3-1 US4-1 FR-002 FR-020 FR-023 creates the categories in order, then the first list, and makes it current', async () => {
    await createInitializeStore({ unitOfWork, ids })(seed);

    expect(await unitOfWork.run((repos) => repos.categories.all())).toEqual([
      { id: 'id-1', name: 'Fruits et légumes', position: 0 },
      { id: 'id-2', name: 'Crèmerie', position: 1 },
      { id: 'id-3', name: 'Boulangerie', position: 2 },
    ]);
    expect(await unitOfWork.run((repos) => repos.lists.all())).toEqual([
      { id: 'id-4', name: 'Ma liste' },
    ]);
    expect(
      await unitOfWork.run((repos) => repos.appState.currentListId()),
    ).toBe('id-4');
  });

  it('FR-023 does nothing on a store that already has a list', async () => {
    await unitOfWork.run(async (repos) => {
      await repos.lists.add({ id: 'l-1' as ListId, name: 'Barbecue' });
      await repos.appState.setCurrentListId('l-1' as ListId);
    });

    await createInitializeStore({ unitOfWork, ids })(seed);

    expect(await unitOfWork.run((repos) => repos.categories.all())).toEqual([]);
    expect(await unitOfWork.run((repos) => repos.lists.all())).toEqual([
      { id: 'l-1', name: 'Barbecue' },
    ]);
    expect(
      await unitOfWork.run((repos) => repos.appState.currentListId()),
    ).toBe('l-1');
    // No id was taken: nothing was even started.
    expect(ids.next()).toBe('id-1');
  });

  it('FR-023 keeps the categories of a store that has no list, and adds the first list', async () => {
    await unitOfWork.run((repos) =>
      repos.categories.add({
        id: 'c-1' as CategoryId,
        name: 'Crèmerie',
        position: 0,
      }),
    );

    await createInitializeStore({ unitOfWork, ids })(seed);

    expect(await unitOfWork.run((repos) => repos.categories.all())).toEqual([
      { id: 'c-1', name: 'Crèmerie', position: 0 },
    ]);
    expect(await unitOfWork.run((repos) => repos.lists.all())).toEqual([
      { id: 'id-1', name: 'Ma liste' },
    ]);
    expect(
      await unitOfWork.run((repos) => repos.appState.currentListId()),
    ).toBe('id-1');
  });

  it('FR-023 runs only once: a second start creates nothing again', async () => {
    const initializeStore = createInitializeStore({ unitOfWork, ids });

    await initializeStore(seed);
    await initializeStore(seed);

    expect(
      await unitOfWork.run((repos) => repos.categories.all()),
    ).toHaveLength(3);
    expect(await unitOfWork.run((repos) => repos.lists.count())).toBe(1);
  });

  it('FR-023 leaves nothing behind when it fails midway, and the next start seeds again', async () => {
    const failure = new Error('failed midway');
    let failing = true;
    // Fails on the last write, once the categories and the list are already added.
    const failingUnitOfWork: UnitOfWork = {
      run: (work) =>
        unitOfWork.run((repos) =>
          work({
            ...repos,
            appState: {
              ...repos.appState,
              setCurrentListId: (id) =>
                failing
                  ? Promise.reject(failure)
                  : repos.appState.setCurrentListId(id),
            },
          }),
        ),
    };
    const initializeStore = createInitializeStore({
      unitOfWork: failingUnitOfWork,
      ids,
    });

    await expect(initializeStore(seed)).rejects.toBe(failure);

    expect(await unitOfWork.run((repos) => repos.categories.all())).toEqual([]);
    expect(await unitOfWork.run((repos) => repos.lists.all())).toEqual([]);
    expect(
      await unitOfWork.run((repos) => repos.appState.currentListId()),
    ).toBeNull();

    failing = false;
    await initializeStore(seed);

    expect(
      await unitOfWork.run((repos) => repos.categories.all()),
    ).toHaveLength(3);
    expect(await unitOfWork.run((repos) => repos.lists.count())).toBe(1);
  });

  describe('recorded changes (US1)', () => {
    const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));

    it('records the seeded categories and the first list, in the order they were created', async () => {
      await createInitializeStore({ unitOfWork, ids })(seed);

      expect(
        (await pending()).map(({ kind, id, fields }) => ({ kind, id, fields })),
      ).toEqual([
        {
          kind: 'category',
          id: 'id-1',
          fields: { name: 'Fruits et légumes', position: 0 },
        },
        {
          kind: 'category',
          id: 'id-2',
          fields: { name: 'Crèmerie', position: 1 },
        },
        {
          kind: 'category',
          id: 'id-3',
          fields: { name: 'Boulangerie', position: 2 },
        },
        { kind: 'list', id: 'id-4', fields: { name: 'Ma liste' } },
      ]);
    });

    it('records only the list when the categories were already there', async () => {
      await unitOfWork.run((repos) =>
        repos.categories.add({
          id: 'c-1' as CategoryId,
          name: 'Crèmerie',
          position: 0,
        }),
      );

      await createInitializeStore({ unitOfWork, ids })(seed);

      expect((await pending()).map((change) => change.kind)).toEqual(['list']);
    });
  });

  describe('held changes (R10)', () => {
    const hold = () =>
      unitOfWork.run((repos) =>
        repos.changes.record(
          'article',
          'a-1',
          { deleted: true },
          { heldBy: 'undo-1' },
        ),
      );
    const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));

    it('releases a deletion left held by a killed app, so it becomes final', async () => {
      await hold();
      expect(await pending()).toEqual([]);

      await createInitializeStore({ unitOfWork, ids })(seed);

      expect((await pending()).map((change) => change.id)).toContain('a-1');
    });

    it('releases it at every start, also on a store that already has a list', async () => {
      await unitOfWork.run(async (repos) => {
        await repos.lists.add({ id: 'l-1' as ListId, name: 'Barbecue' });
        await repos.appState.setCurrentListId('l-1' as ListId);
      });
      await hold();

      await createInitializeStore({ unitOfWork, ids })(seed);

      expect((await pending()).map((change) => change.id)).toEqual(['a-1']);
    });
  });
});
