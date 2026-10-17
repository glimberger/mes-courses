import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Text } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme } from './theme';
import { ThemeProvider } from './theme-provider';

// The Material Symbols glyph of `search` (e.g. Paper's `magnify`), from the generated glyph map.
const SEARCH_GLYPH = String.fromCodePoint(0xef7a);

let mockColorScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme,
}));

let mockFontLoaded = false;
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: () => mockFontLoaded,
}));

const ThemeName = () => {
  const { colors } = useTheme();
  const name =
    colors.surface === lightTheme.colors.surface
      ? 'light'
      : colors.surface === darkTheme.colors.surface
        ? 'dark'
        : 'other';
  return <Text>{name}</Text>;
};

describe('ThemeProvider', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    [null, 'light'],
  ] as const)(
    'gives Paper the %s system scheme as the %s theme',
    (scheme, expected) => {
      mockColorScheme = scheme;

      render(
        <ThemeProvider>
          <ThemeName />
        </ThemeProvider>,
      );

      expect(screen.getByText(expected)).toBeOnTheScreen();
    },
  );
});

describe('an appearance given to the provider', () => {
  it.each([
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
  ] as const)(
    'shows the %s theme when the system scheme is %s',
    (appearance, scheme, expected) => {
      mockColorScheme = scheme;

      render(
        <ThemeProvider appearance={appearance}>
          <ThemeName />
        </ThemeProvider>,
      );

      expect(screen.getByText(expected)).toBeOnTheScreen();
    },
  );
});

describe('the Material Symbols icons', () => {
  it('draws a Paper icon name with its glyph in the weight 500 font', () => {
    mockFontLoaded = true;

    render(
      <ThemeProvider>
        <IconButton
          icon="magnify"
          onPress={jest.fn()}
          accessibilityLabel="Rechercher"
        />
      </ThemeProvider>,
    );

    expect(screen.getByText(SEARCH_GLYPH)).toHaveStyle({
      fontFamily: 'MaterialSymbolsRounded_500',
    });
    mockFontLoaded = false;
  });
});

describe('the fonts App.tsx bundles (FR-015)', () => {
  const APP_FILE = path.resolve(__dirname, '../../../../App.tsx');
  const FONTS_FILE = path.resolve(__dirname, './fonts.ts');

  it('loads every font from a local asset, never from a URL', () => {
    const app = readFileSync(APP_FILE, 'utf8');
    const loaded = app.match(/Font\.loadAsync\(\{([\s\S]*?)\}\)/)?.[1] ?? '';
    // The Nunito files are listed in theme/fonts.ts, which App.tsx spreads.
    expect(loaded).toContain('...nunitoFontFiles');
    const nunito = readFileSync(FONTS_FILE, 'utf8');
    const entries = [...(loaded + nunito).matchAll(/(\w+): (.+)/g)].map(
      ([, family, source]) => ({ family, source }),
    );

    expect(entries.map(({ family }) => family)).toEqual(
      expect.arrayContaining(['Nunito_600SemiBold']),
    );
    for (const { family, source } of entries) {
      expect({ family, local: source }).toEqual({
        family,
        local: expect.stringMatching(
          /^require\('(\.\/|(\.\.\/){4})assets\/fonts\/[^']+\.ttf'\),?$/,
        ),
      });
    }
  });
});
