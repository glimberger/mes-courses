import type { UnitOfWork } from '../ports/unit-of-work';

/** An undo offer ended: its held changes become pending (research R10). */
export const createReleaseHeldChanges =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (undoId: string): Promise<void> =>
    unitOfWork.run((repos) => repos.changes.release(undoId));
