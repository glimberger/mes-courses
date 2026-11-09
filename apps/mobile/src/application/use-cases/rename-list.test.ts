import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createRenameList } from './rename-list';

const maListe = { id: 'l-1' as ListId, name: 'Ma liste' };
const barbecue = { id: 'l-2' as ListId, name: 'Barbecue' };

describe('renameList', () => {
  let unitOfWork: UnitOfWork;
  let renameList: ReturnType<typeof createRenameList>;
  const lists = () => unitOfWork.run((repos) => repos.lists.all());
  const pending = () =>
    unitOfWork
      .run((repos) => repos.changes.pending(100))
      .then((changes) =>
        changes.map(({ kind, id, fields }) => ({ kind, id, fields })),
      );

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    renameList = createRenameList({ unitOfWork });
    await unitOfWork.run(async (repos) => {
      await repos.lists.add(maListe);
      await repos.lists.add(barbecue);
      await repos.appState.setCurrentListId(maListe.id);
    });
  });

  it('US1-1 saves the new name cleaned and records list.name', async () => {
    const outcome = await renameList(barbecue.id, '  Week-end   à la mer ');

    expect(outcome).toEqual(ok(undefined));
    expect(await lists()).toContainEqual({
      id: barbecue.id,
      name: 'Week-end à la mer',
    });
    expect(await pending()).toEqual([
      {
        kind: 'list',
        id: barbecue.id,
        fields: { name: 'Week-end à la mer' },
      },
    ]);
  });

  it('keeps the list current and its items when renaming it', async () => {
    await renameList(maListe.id, 'Courses');

    expect(
      await unitOfWork.run((repos) => repos.appState.currentListId()),
    ).toBe(maListe.id);
  });

  it('US1-5 accepts its own name unchanged, recording nothing', async () => {
    expect(await renameList(barbecue.id, 'Barbecue')).toEqual(ok(undefined));
    expect(await pending()).toEqual([]);
  });

  it('US1-5 accepts a change of case or spacing, recording it', async () => {
    expect(await renameList(barbecue.id, ' BARBECUE ')).toEqual(ok(undefined));

    expect(await lists()).toContainEqual({
      id: barbecue.id,
      name: 'BARBECUE',
    });
    expect(await pending()).toEqual([
      { kind: 'list', id: barbecue.id, fields: { name: 'BARBECUE' } },
    ]);
  });

  it('US1-4 refuses the name of another list, changing and recording nothing', async () => {
    const outcome = await renameList(barbecue.id, 'ma LISTE');

    expect(outcome).toEqual(
      err({ type: 'NameAlreadyUsed', existing: maListe }),
    );
    expect(await lists()).toEqual([maListe, barbecue]);
    expect(await pending()).toEqual([]);
  });

  it('refuses a blank name with NameRequired', async () => {
    expect(await renameList(barbecue.id, '   ')).toEqual(
      err({ type: 'NameRequired' }),
    );
    expect(await pending()).toEqual([]);
  });

  it('refuses a name of 61 characters with NameTooLong', async () => {
    expect(await renameList(barbecue.id, 'a'.repeat(61))).toEqual(
      err({ type: 'NameTooLong' }),
    );
    expect(await lists()).toEqual([maListe, barbecue]);
  });

  it('returns ListNotFound for an unknown list, recording nothing', async () => {
    expect(await renameList('l-9' as ListId, 'Courses')).toEqual(
      err({ type: 'ListNotFound' }),
    );
    expect(await pending()).toEqual([]);
  });
});
