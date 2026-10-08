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
 * already has it.
 */
export const uniqueName = async <T>(
  repository: { findByNormalizedName(name: string): Promise<T | null> },
  name: string,
): Promise<Result<string, NameError | NameAlreadyUsed<T>>> => {
  const validated = validateName(name);
  if (!validated.ok) return validated;
  const existing = await repository.findByNormalizedName(
    normalizedName(validated.value),
  );
  return existing
    ? err({ type: 'NameAlreadyUsed', existing })
    : ok(validated.value);
};
