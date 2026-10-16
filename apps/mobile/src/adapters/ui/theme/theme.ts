import {
  MD3DarkTheme,
  MD3LightTheme,
  configureFonts,
  type MD3Theme,
} from 'react-native-paper';

import materialTheme from '../../../../../../design/material-theme.json';

// Nunito is the single application typeface (research R4); the registered TTF names are
// the family names Paper reads, so they stay aligned with expo-font registration.
const nunitoFonts = configureFonts({
  isV3: true,
  config: {
    default: { fontFamily: 'Nunito_400Regular' },
    displayLarge: { fontFamily: 'Nunito_400Regular' },
    displayMedium: { fontFamily: 'Nunito_400Regular' },
    displaySmall: { fontFamily: 'Nunito_400Regular' },
    headlineLarge: { fontFamily: 'Nunito_700Bold' },
    headlineMedium: { fontFamily: 'Nunito_700Bold' },
    headlineSmall: { fontFamily: 'Nunito_700Bold' },
    titleLarge: { fontFamily: 'Nunito_800ExtraBold' },
    titleMedium: { fontFamily: 'Nunito_600SemiBold' },
    titleSmall: { fontFamily: 'Nunito_600SemiBold' },
    bodyLarge: { fontFamily: 'Nunito_400Regular' },
    bodyMedium: { fontFamily: 'Nunito_400Regular' },
    bodySmall: { fontFamily: 'Nunito_400Regular' },
    labelLarge: { fontFamily: 'Nunito_600SemiBold' },
    labelMedium: { fontFamily: 'Nunito_600SemiBold' },
    labelSmall: { fontFamily: 'Nunito_600SemiBold' },
  },
} as never);

type Scheme = typeof materialTheme.schemes.light;

/** A color role of the Material Theme Builder export (research R2). */
export type SchemeRole = keyof Scheme;

/** Paper's MD3 theme, with every role of the export (the surface containers among them). */
export type AppTheme = MD3Theme & { colors: MD3Theme['colors'] & Scheme };

const rgba = (hex: string, alpha: number): string => {
  const [red, green, blue] = [1, 3, 5].map((start) =>
    parseInt(hex.slice(start, start + 2), 16),
  );
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

// The roles Paper needs and the export lacks are derived from the export, so
// design/material-theme.json stays the only color source (Principle V).
const buildTheme = (base: MD3Theme, scheme: Scheme): AppTheme => ({
  ...base,
  fonts: nunitoFonts as never,
  colors: {
    ...base.colors,
    ...scheme,
    surfaceDisabled: rgba(scheme.onSurface, 0.12),
    onSurfaceDisabled: rgba(scheme.onSurface, 0.38),
    backdrop: rgba(scheme.scrim, 0.4),
    // Paper paints a Surface with its level: level0 stays transparent so a flat Surface shows
    // its parent; the others follow Material 3's surface container for each elevation.
    elevation: {
      level0: base.colors.elevation.level0,
      level1: scheme.surfaceContainerLow,
      level2: scheme.surfaceContainer,
      level3: scheme.surfaceContainerHigh,
      level4: scheme.surfaceContainerHighest,
      level5: scheme.surfaceContainerHighest,
    },
  },
});

export const lightTheme = buildTheme(
  MD3LightTheme,
  materialTheme.schemes.light,
);
export const darkTheme = buildTheme(MD3DarkTheme, materialTheme.schemes.dark);
