import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import type { UnitOfWork } from '../ports/unit-of-work';
import { createReleaseHeldChanges } from './release-held-changes';

describe('releaseHeldChanges', () => {
  let unitOfWork: UnitOfWork;
  const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));
  const hold = (id: string, undoId: string) =>
    unitOfWork.run((repos) =>
      repos.changes.record('list', id, { name: id }, { heldBy: undoId }),
    );

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
  });

  it('FR-008 makes the entries held by this undo id pending', async () => {
    await hold('l-1', 'undo-1');
    expect(await pending()).toEqual([]);

    await createReleaseHeldChanges({ unitOfWork })('undo-1');

    expect((await pending()).map((change) => change.id)).toEqual(['l-1']);
  });

  it('leaves the entries held by another undo id', async () => {
    await hold('l-1', 'undo-1');
    await hold('l-2', 'undo-2');

    await createReleaseHeldChanges({ unitOfWork })('undo-1');

    expect((await pending()).map((change) => change.id)).toEqual(['l-1']);
  });

  it('US1-7 does nothing for an undo id whose entries were discarded', async () => {
    await hold('l-1', 'undo-1');
    await unitOfWork.run((repos) => repos.changes.discard('undo-1'));

    await createReleaseHeldChanges({ unitOfWork })('undo-1');

    expect(await pending()).toEqual([]);
  });
});
