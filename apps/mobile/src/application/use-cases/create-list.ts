import {
  normalizedName,
  validateName,
  type NameAlreadyUsed,
  type NameError,
} from '../../domain/name';
import { err, ok, type Result } from '../../domain/result';
import type { ListId, ShoppingList } from '../../domain/shopping-list';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * Creates an empty list, its name cleaned (FR-022), without making it current (US3-2, FR-024).
 * A name another list already has creates nothing (US3-5, FR-021).
 */
export const createCreateList =
  ({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) =>
  (
    name: string,
  ): Promise<
    Result<{ listId: ListId }, NameError | NameAlreadyUsed<ShoppingList>>
  > =>
    unitOfWork.run(async (repos) => {
      const validated = validateName(name);
      if (!validated.ok) return validated;
      const existing = await repos.lists.findByNormalizedName(
        normalizedName(validated.value),
      );
      if (existing) return err({ type: 'NameAlreadyUsed', existing });

      const listId = ids.next() as ListId;
      await repos.lists.add({ id: listId, name: validated.value });
      return ok({ listId });
    });
