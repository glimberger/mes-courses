import glyphs from './symbols-glyphs.json';

/** Paper's internal icon names and the legacy names, mapped to their Material Symbols name. */
export const ICON_ALIASES: Readonly<Record<string, string>> = {
  magnify: 'search',
  close: 'close',
  'arrow-left': 'arrow_back',
  'chevron-left': 'arrow_back',
  'menu-down': 'arrow_drop_down',
  check: 'check',
  minus: 'remove',
  eye: 'visibility',
  'eye-off': 'visibility_off',
  'alert-circle': 'error',
};

/** The Material Symbol a name draws: its alias when it has one, the name itself otherwise. */
export const resolveSymbol = (name: string): string =>
  (Object.hasOwn(ICON_ALIASES, name) ? ICON_ALIASES[name] : undefined) ?? name;

/** Whether the bundled subset has a glyph for this Material Symbol. */
export const hasGlyph = (symbol: string): boolean =>
  Object.hasOwn(glyphs, symbol);

/** The names (aliased or not) that no bundled glyph draws, in their given order. */
export const unresolvedIcons = (names: readonly string[]): string[] =>
  names.filter((name) => !hasGlyph(resolveSymbol(name)));
