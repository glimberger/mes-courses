// Zero-width space, non-joiner and joiner, word joiner, byte order mark.
const INVISIBLE_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/gu;

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

/**
 * The form compared for uniqueness (FR-021): case, ligatures and the apostrophe style are
 * ignored, accents are kept.
 */
export const normalizedName = (name: string): string =>
  cleanName(name)
    .toLocaleLowerCase('fr')
    .replaceAll('œ', 'oe')
    .replaceAll('æ', 'ae')
    .replaceAll('’', "'");
