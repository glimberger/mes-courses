import type { Category, CategoryId } from '../../domain/category';
import {
  normalizedName,
  validateName,
  type NameAlreadyUsed,
  type NameError,
} from '../../domain/name';
import { err, ok, type Result } from '../../domain/result';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';

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
      const validated = validateName(name);
      if (!validated.ok) return validated;
      const existing = await repos.categories.findByNormalizedName(
        normalizedName(validated.value),
      );
      if (existing) return err({ type: 'NameAlreadyUsed', existing });

      const categoryId = ids.next() as CategoryId;
      await repos.categories.add({
        id: categoryId,
        name: validated.value,
        position: await repos.categories.nextPosition(),
      });
      return ok({ categoryId });
    });
