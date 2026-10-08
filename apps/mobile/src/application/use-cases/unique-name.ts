import {
  normalizedName,
  validateName,
  type NameAlreadyUsed,
  type NameError,
} from '../../domain/name';
import { err, ok, type Result } from '../../domain/result';

/**
 * The rule every named entity follows: the name is cleaned and checked (FR-022), then no other
 * entity of the same kind may have it (FR-021). Returns the clean name, or the entity that
 * already has it. `isSelf` lets an entity keep its own name when editing (002 US1-5).
 */
export const uniqueName = async <T>(
  repository: { findByNormalizedName(name: string): Promise<T | null> },
  name: string,
  isSelf: (existing: T) => boolean = () => false,
): Promise<Result<string, NameError | NameAlreadyUsed<T>>> => {
  const validated = validateName(name);
  if (!validated.ok) return validated;
  const existing = await repository.findByNormalizedName(
    normalizedName(validated.value),
  );
  return existing && !isSelf(existing)
    ? err({ type: 'NameAlreadyUsed', existing })
    : ok(validated.value);
};
