import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react-native';

import { AppIcon } from './AppIcon';
import { ICON_ALIASES, hasGlyph, unresolvedIcons } from './aliases';

const SYMBOLS_FILE = path.join(__dirname, 'symbols.txt');

const symbolNames = readFileSync(SYMBOLS_FILE, 'utf8')
  .split('\n')
  .filter((line) => line.length > 0);

const UI_ROOT = path.resolve(__dirname, '..');

// Icon names written as literals in the components and screens: `icon="x"`, `icon: 'x'`,
// `source={cond ? 'x' : 'y'}` and the like. Each quoted name on such a line is a name to draw.
const literalIconNames = (): string[] =>
  globSync('{components,screens}/**/*.tsx', { cwd: UI_ROOT })
    .filter((file) => !/\.(test|stories)\.tsx$/.test(file))
    .flatMap((file) =>
      readFileSync(path.join(UI_ROOT, file), 'utf8')
        .split('\n')
        .filter((line) => /\bicon\b|\bsource=/.test(line))
        .flatMap((line) =>
          // Other attributes on the line (`tone="brand"`, `testID="x"`) are not icon names.
          [
            ...line
              .replace(/\b(?!icon\b|source\b)\w+=(["'])[^"']*\1/g, '')
              .matchAll(/['"]([a-z][a-z0-9_-]*)['"]/g),
          ].map(([, name = '']) => name),
        ),
    );

describe('the Material Symbols icon set', () => {
  it.each(Object.entries(ICON_ALIASES))(
    'maps Paper name %s to the symbol %s, which has a glyph',
    (_paperName, symbol) => {
      expect(hasGlyph(symbol)).toBe(true);
    },
  );

  it.each(symbolNames)('resolves the listed symbol %s to a glyph', (symbol) => {
    expect(hasGlyph(symbol)).toBe(true);
  });

  it.each([
    'shopping_cart',
    'grocery',
    'add_circle',
    'check_circle',
    'remove_shopping_cart',
    'info',
    'format_list_bulleted',
    'settings',
    'more_vert',
  ])('resolves the symbol %s the tab navigation draws', (symbol) => {
    expect(hasGlyph(symbol)).toBe(true);
  });

  it('draws every icon name the components and screens write as a literal', () => {
    const names = literalIconNames();
    expect(names.length).toBeGreaterThan(20);
    expect(unresolvedIcons(names)).toEqual([]);
  });

  it('reports an unknown name, and only that one', () => {
    expect(unresolvedIcons(['magnify', 'add', 'no_such_symbol'])).toEqual([
      'no_such_symbol',
    ]);
  });

  it.each([500, 700] as const)('renders an icon at weight %i', (weight) => {
    expect(() =>
      render(<AppIcon name="magnify" weight={weight} />),
    ).not.toThrow();
  });

  it('renders the filled form of check_circle', () => {
    expect(() =>
      render(<AppIcon name="check_circle" filled testID="filled" />),
    ).not.toThrow();
  });

  it('uses the filled font instance for a filled icon, and only then', () => {
    const filled = render(<AppIcon name="check_circle" filled testID="a" />);
    const outline = render(<AppIcon name="check_circle" testID="b" />);
    const fontOf = (screen: typeof filled, id: string) =>
      JSON.stringify(screen.getByTestId(id).props.style);
    expect(fontOf(filled, 'a')).toContain('MaterialSymbolsRounded_500_filled');
    expect(fontOf(outline, 'b')).not.toContain('_filled');
  });

  it('bundles the filled instance', () => {
    expect(
      existsSync(
        path.join(
          __dirname,
          '../../../../assets/fonts/MaterialSymbolsRounded_500_filled.ttf',
        ),
      ),
    ).toBe(true);
  });
});
