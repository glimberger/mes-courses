import { MD3LightTheme } from 'react-native-paper';

import materialTheme from '../../../../../../design/material-theme.json';
import { spacing } from './spacing';
import { darkTheme, lightTheme } from './theme';
import { usedColorPairs } from './used-color-pairs';

const themes = [
  { name: 'light', theme: lightTheme, scheme: materialTheme.schemes.light },
  { name: 'dark', theme: darkTheme, scheme: materialTheme.schemes.dark },
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

describe.each(themes)('the $name theme', ({ name, theme, scheme }) => {
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

  it('derives the elevation levels from the surface containers', () => {
    expect(theme.colors.elevation).toEqual({
      level0: scheme.surfaceContainerLowest,
      level1: scheme.surfaceContainerLow,
      level2: scheme.surfaceContainer,
      level3: scheme.surfaceContainerHigh,
      level4: scheme.surfaceContainerHighest,
      level5: scheme.surfaceContainerHighest,
    });
  });

  it('derives the disabled and backdrop roles from onSurface and scrim', () => {
    const rgb = (hex: string) =>
      [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
    const rgba = (hex: string, alpha: number) =>
      `rgba(${rgb(hex).join(', ')}, ${alpha})`;

    expect(theme.colors.surfaceDisabled).toBe(rgba(scheme.onSurface, 0.12));
    expect(theme.colors.onSurfaceDisabled).toBe(rgba(scheme.onSurface, 0.38));
    expect(theme.colors.backdrop).toBe(rgba(scheme.scrim, 0.4));
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
