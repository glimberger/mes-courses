import { cleanName, normalizedName } from '@mes-courses/sync-core';

import { err, ok, type Result } from './result';

// Moved to the shared package (003); re-exported so 001's imports stay unchanged.
export { cleanName, normalizedName };

/** Names of articles, categories and lists hold at most this many code points once cleaned. */
export const MAX_NAME_LENGTH = 60;

export type NameRequired = { type: 'NameRequired' };
export type NameTooLong = { type: 'NameTooLong' };
export type NameError = NameRequired | NameTooLong;
/** Another entity of the same kind already has this name (FR-021); it carries that entity. */
export type NameAlreadyUsed<T> = { type: 'NameAlreadyUsed'; existing: T };

const collator = new Intl.Collator('fr', {
  sensitivity: 'base',
  numeric: true,
});

/** Counts code points, as SQLite's `length()` does, so an emoji counts once. */
export const nameLength = (name: string): number => [...name].length;

export const validateName = (text: string): Result<string, NameError> => {
  const name = cleanName(text);
  if (name === '') return err({ type: 'NameRequired' });
  if (nameLength(name) > MAX_NAME_LENGTH) return err({ type: 'NameTooLong' });
  return ok(name);
};

/** The normalized name without diacritics, matched as a substring when searching (FR-009). */
export const searchForm = (text: string): string =>
  normalizedName(text).normalize('NFD').replace(/\p{M}/gu, '');

/** The one name order of the app: French collation, numbers compared by value. */
export const compareNames = (a: string, b: string): number =>
  collator.compare(a, b);
