import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { createCreateList } from './create-list';

const maListe = 'l-1' as ListId;
const barbecue = { id: 'l-2' as ListId, name: 'Barbecue' };

describe('createList', () => {
  let unitOfWork: UnitOfWork;
  let createList: ReturnType<typeof createCreateList>;
  const lists = () => unitOfWork.run((repos) => repos.lists.all());
  const currentListId = () =>
    unitOfWork.run((repos) => repos.appState.currentListId());

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    createList = createCreateList({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    });
    await unitOfWork.run(async (repos) => {
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US3-2 FR-024 creates an empty list and does not make it current', async () => {
    const outcome = await createList('Week-end');

    expect(outcome).toEqual(ok({ listId: 'id-1' }));
    expect(await lists()).toContainEqual({ id: 'id-1', name: 'Week-end' });
    expect(
      await unitOfWork.run((repos) => repos.items.forList('id-1' as ListId)),
    ).toEqual([]);
    expect(await currentListId()).toBe(maListe);
  });

  it('FR-022 stores the name cleaned: "  Week-end   à la mer " is created as "Week-end à la mer"', async () => {
    await createList('  Week-end   à la mer ');

    expect((await lists()).map((list) => list.name)).toContain(
      'Week-end à la mer',
    );
  });

  it('US3-5 FR-021 refuses "barbecue" with NameAlreadyUsed carrying the existing list, creating nothing', async () => {
    await unitOfWork.run((repos) => repos.lists.add(barbecue));

    const outcome = await createList('barbecue');

    expect(outcome).toEqual(
      err({ type: 'NameAlreadyUsed', existing: barbecue }),
    );
    expect(await lists()).toHaveLength(2);
  });

  it('US3-6 refuses a blank name with NameRequired, creating nothing', async () => {
    const outcome = await createList('   ');

    expect(outcome).toEqual(err({ type: 'NameRequired' }));
    expect(await lists()).toHaveLength(1);
  });

  it('FR-022 refuses a name of 61 characters with NameTooLong', async () => {
    const outcome = await createList('a'.repeat(61));

    expect(outcome).toEqual(err({ type: 'NameTooLong' }));
    expect(await lists()).toHaveLength(1);
  });
});
