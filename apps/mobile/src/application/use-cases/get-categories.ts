import type { CategoryId } from '../../domain/category';
import type { UnitOfWork } from '../ports/unit-of-work';

/** The categories ordered by position, for the category picker (US4-1, US4-2). */
export const createGetCategories =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (): Promise<{ id: CategoryId; name: string }[]> =>
    unitOfWork.run(async (repos) =>
      (await repos.categories.all()).map(({ id, name }) => ({ id, name })),
    );
