import type { Category, CategoryId } from '../../domain/category';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import { ok, type Result } from '../../domain/result';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';
import { uniqueName } from './unique-name';

/**
 * Creates a category, its name cleaned (FR-022), after the existing ones (US4-2, FR-019).
 * A name another category already has creates nothing (US4-3, FR-021).
 */
export const createCreateCategory =
  ({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) =>
  (
    name: string,
  ): Promise<
    Result<{ categoryId: CategoryId }, NameError | NameAlreadyUsed<Category>>
  > =>
    unitOfWork.run(async (repos) => {
      const unique = await uniqueName(repos.categories, name);
      if (!unique.ok) return unique;

      const categoryId = ids.next() as CategoryId;
      const position = await repos.categories.nextPosition();
      await repos.categories.add({
        id: categoryId,
        name: unique.value,
        position,
      });
      await repos.changes.record('category', categoryId, {
        name: unique.value,
        position,
      });
      return ok({ categoryId });
    });
