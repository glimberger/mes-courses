import { err, ok, type Result } from './result';

/** Names of articles, categories and lists hold at most this many code points once cleaned. */
export const MAX_NAME_LENGTH = 60;

export type NameRequired = { type: 'NameRequired' };
export type NameTooLong = { type: 'NameTooLong' };
export type NameError = NameRequired | NameTooLong;

// Zero-width space, non-joiner and joiner, word joiner, byte order mark.
const INVISIBLE_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/gu;

const collator = new Intl.Collator('fr', {
  sensitivity: 'base',
  numeric: true,
});

/**
 * The form of a name that is validated, stored and shown: composed accents, invisible characters
 * removed, trimmed, inner white space reduced to one space (FR-021, FR-022).
 */
export const cleanName = (text: string): string =>
  text
    .normalize('NFC')
    .replace(INVISIBLE_CHARACTERS, '')
    .trim()
    .replace(/\s+/gu, ' ');

/** Counts code points, as SQLite's `length()` does, so an emoji counts once. */
export const nameLength = (name: string): number => [...name].length;

export const validateName = (text: string): Result<string, NameError> => {
  const name = cleanName(text);
  if (name === '') return err({ type: 'NameRequired' });
  if (nameLength(name) > MAX_NAME_LENGTH) return err({ type: 'NameTooLong' });
  return ok(name);
};

/**
 * The form compared for uniqueness (FR-021): case, ligatures and the apostrophe style are
 * ignored, accents are kept.
 */
export const normalizedName = (name: string): string =>
  cleanName(name)
    .toLocaleLowerCase('fr')
    .replaceAll('œ', 'oe')
    .replaceAll('æ', 'ae')
    .replaceAll('\u2019', "'");

/** The normalized name without diacritics, matched as a substring when searching (FR-009). */
export const searchForm = (text: string): string =>
  normalizedName(text).normalize('NFD').replace(/\p{M}/gu, '');

/** The one name order of the app: French collation, numbers compared by value. */
export const compareNames = (a: string, b: string): number =>
  collator.compare(a, b);
