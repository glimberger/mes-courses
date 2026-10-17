import { readFileSync } from 'node:fs';
import path from 'node:path';

import { MD3LightTheme } from 'react-native-paper';

import materialTheme from '../../../../../../design/material-theme.json';
import { spacing } from './spacing';
import { darkTheme, lightTheme, type SchemeRole } from './theme';
import { usedColorPairs } from './used-color-pairs';

// onSurface (#1E1B13 light, #E8E2D4 dark) and scrim (#141108) written out as RGB, so the
// derived roles are checked against values computed by hand, not by the code under test.
const themes = [
  {
    name: 'light',
    theme: lightTheme,
    scheme: materialTheme.schemes.light,
    onSurfaceRgb: '30, 27, 19',
    scrimRgb: '20, 17, 8',
  },
  {
    name: 'dark',
    theme: darkTheme,
    scheme: materialTheme.schemes.dark,
    onSurfaceRgb: '232, 226, 212',
    scrimRgb: '20, 17, 8',
  },
] as const;

// Paper roles the Material Theme Builder export has no entry for: derived in theme.ts.
const DERIVED_ROLES = new Set([
  'elevation',
  'surfaceDisabled',
  'onSurfaceDisabled',
  'backdrop',
]);

// WCAG 2.2 relative luminance of a `#RRGGBB` color.
const luminance = (hex: string): number => {
  const linear = (start: number) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
};

const contrastRatio = (first: string, second: string): number => {
  const [one, two] = [luminance(first), luminance(second)];
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
};

describe.each(themes)(
  'the $name theme',
  ({ name, theme, scheme, onSurfaceRgb, scrimRgb }) => {
    it(`is ${name === 'dark' ? '' : 'not '}a dark theme`, () => {
      expect(theme.dark).toBe(name === 'dark');
    });

    it('takes every Paper MD3 color role from design/material-theme.json', () => {
      const paperRoles = Object.keys(MD3LightTheme.colors).filter(
        (role) => !DERIVED_ROLES.has(role),
      );
      for (const role of paperRoles) {
        expect({
          role,
          color: theme.colors[role as keyof typeof scheme],
        }).toEqual({ role, color: scheme[role as keyof typeof scheme] });
      }
    });

    it('carries every role of the export, surface containers included', () => {
      for (const [role, color] of Object.entries(scheme)) {
        expect({
          role,
          color: theme.colors[role as keyof typeof scheme],
        }).toEqual({ role, color });
      }
    });

    it('derives the elevation levels from the surface containers, level0 staying transparent', () => {
      expect(theme.colors.elevation).toEqual({
        level0: 'transparent',
        level1: scheme.surfaceContainerLow,
        level2: scheme.surfaceContainer,
        level3: scheme.surfaceContainerHigh,
        level4: scheme.surfaceContainerHighest,
        level5: scheme.surfaceContainerHighest,
      });
    });

    it('derives the disabled and backdrop roles from onSurface and scrim', () => {
      expect(theme.colors.surfaceDisabled).toBe(`rgba(${onSurfaceRgb}, 0.12)`);
      expect(theme.colors.onSurfaceDisabled).toBe(
        `rgba(${onSurfaceRgb}, 0.38)`,
      );
      expect(theme.colors.backdrop).toBe(`rgba(${scrimRgb}, 0.36)`);
    });

    describe('FR-036 meets WCAG AA contrast on every color pair the app draws', () => {
      it.each(usedColorPairs)(
        '$foreground on $background ($kind)',
        ({ foreground, background, kind }) => {
          const minimum = kind === 'text' ? 4.5 : 3;
          expect(
            contrastRatio(scheme[foreground], scheme[background]),
          ).toBeGreaterThanOrEqual(minimum);
        },
      );
    });
  },
);

describe('Nunito typography', () => {
  it('uses a bundled Nunito family for every Paper type role', () => {
    for (const variant of Object.values(lightTheme.fonts)) {
      expect(variant.fontFamily).toMatch(/^Nunito_/);
    }
  });
});

describe('spacing tokens', () => {
  it('go from xs = 4 to xl = 32', () => {
    expect(spacing).toEqual({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 });
  });

  it('sit on the 4 dp grid', () => {
    for (const value of Object.values(spacing)) {
      expect(value % 4).toBe(0);
    }
  });
});

// The mockup stylesheet (design/mockups/styles.css) is the visual reference: each color token of
// its :root and body.dark blocks is the export role it stands for (SC-004). A token missing from
// body.dark keeps its light value in dark.
const STYLES_CSS = readFileSync(
  path.resolve(__dirname, '../../../../../../design/mockups/styles.css'),
  'utf8',
);

const colorTokens = (block: RegExp): Record<string, string> => {
  const body = STYLES_CSS.match(block)?.[1] ?? '';
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(
      ([, token, color = '']) => [token, color.toLowerCase()],
    ),
  );
};

const lightTokens = colorTokens(/:root\s*\{([^}]*)\}/);
const darkTokens = {
  ...lightTokens,
  ...colorTokens(/body\.dark\s*\{([^}]*)\}/),
};

const MOCKUP_TOKEN_ROLES: readonly (readonly [string, SchemeRole])[] = [
  ['--bg', 'surface'],
  ['--bg', 'background'],
  ['--card', 'surfaceContainerLowest'],
  ['--container', 'surfaceContainer'],
  ['--on-surface', 'onSurface'],
  ['--on-surface-var', 'onSurfaceVariant'],
  ['--muted', 'outline'],
  ['--hairline', 'surfaceContainerHigh'],
  ['--primary', 'primary'],
  ['--yellow', 'primaryContainer'],
  ['--on-yellow', 'onPrimaryContainer'],
  ['--yellow-soft', 'brandSoft'],
  ['--secondary-container', 'secondaryContainer'],
  ['--on-secondary-container', 'onSecondaryContainer'],
  ['--tertiary-container', 'tertiaryContainer'],
  ['--on-tertiary-container', 'onTertiaryContainer'],
  ['--error', 'error'],
  ['--inverse-surface', 'inverseSurface'],
  ['--inverse-on-surface', 'inverseOnSurface'],
  ['--inverse-primary', 'inversePrimary'],
];

describe.each([
  { name: 'light', tokens: lightTokens, scheme: materialTheme.schemes.light },
  { name: 'dark', tokens: darkTokens, scheme: materialTheme.schemes.dark },
])(
  'SC-004 the $name mockup tokens equal their export roles',
  ({ tokens, scheme }) => {
    it.each(MOCKUP_TOKEN_ROLES)('%s is %s', (token, role) => {
      expect({
        token,
        color: scheme[role].toLowerCase(),
      }).toEqual({
        token,
        color: tokens[token],
      });
    });
  },
);
