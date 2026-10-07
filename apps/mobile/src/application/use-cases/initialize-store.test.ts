import type { ListId } from '../../domain/shopping-list';
import type { Repositories, UnitOfWork } from '../ports/unit-of-work';
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

/** Reads the store in a run of its own, as the next use case would. */
const read = <T>(
  unitOfWork: UnitOfWork,
  query: (repos: Repositories) => Promise<T>,
) => unitOfWork.run(query);

describe('initializeStore', () => {
  let unitOfWork: UnitOfWork;
  let ids: SequentialIdGenerator;

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    ids = new SequentialIdGenerator();
  });

  it('US3-1 US4-1 FR-020 FR-023 creates the categories in order, then the first list, and makes it current', async () => {
    await createInitializeStore({ unitOfWork, ids })(seed);

    expect(await read(unitOfWork, (repos) => repos.categories.all())).toEqual([
      { id: 'id-1', name: 'Fruits et légumes', position: 0 },
      { id: 'id-2', name: 'Crèmerie', position: 1 },
      { id: 'id-3', name: 'Boulangerie', position: 2 },
    ]);
    expect(await read(unitOfWork, (repos) => repos.lists.all())).toEqual([
      { id: 'id-4', name: 'Ma liste' },
    ]);
    expect(
      await read(unitOfWork, (repos) => repos.appState.currentListId()),
    ).toBe('id-4');
  });

  it('FR-023 does nothing on a store that already has a list', async () => {
    await unitOfWork.run(async (repos) => {
      await repos.lists.add({ id: 'l-1' as ListId, name: 'Barbecue' });
      await repos.appState.setCurrentListId('l-1' as ListId);
    });

    await createInitializeStore({ unitOfWork, ids })(seed);

    expect(await read(unitOfWork, (repos) => repos.categories.all())).toEqual(
      [],
    );
    expect(await read(unitOfWork, (repos) => repos.lists.all())).toEqual([
      { id: 'l-1', name: 'Barbecue' },
    ]);
    expect(
      await read(unitOfWork, (repos) => repos.appState.currentListId()),
    ).toBe('l-1');
  });

  it('FR-023 runs only once: a second start creates nothing again', async () => {
    const initializeStore = createInitializeStore({ unitOfWork, ids });

    await initializeStore(seed);
    await initializeStore(seed);

    expect(
      await read(unitOfWork, (repos) => repos.categories.all()),
    ).toHaveLength(3);
    expect(await read(unitOfWork, (repos) => repos.lists.count())).toBe(1);
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

    expect(await read(unitOfWork, (repos) => repos.categories.all())).toEqual(
      [],
    );
    expect(await read(unitOfWork, (repos) => repos.lists.all())).toEqual([]);
    expect(
      await read(unitOfWork, (repos) => repos.appState.currentListId()),
    ).toBeNull();

    failing = false;
    await initializeStore(seed);

    expect(
      await read(unitOfWork, (repos) => repos.categories.all()),
    ).toHaveLength(3);
    expect(await read(unitOfWork, (repos) => repos.lists.count())).toBe(1);
  });
});
