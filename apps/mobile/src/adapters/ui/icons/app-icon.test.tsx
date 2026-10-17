import { readFileSync } from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react-native';

import { AppIcon } from './AppIcon';
import { ICON_ALIASES, hasGlyph, unresolvedIcons } from './aliases';

const SYMBOLS_FILE = path.join(__dirname, 'symbols.txt');

const symbolNames = readFileSync(SYMBOLS_FILE, 'utf8')
  .split('\n')
  .filter((line) => line.length > 0);

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
});
