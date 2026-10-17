import { MD3LightTheme } from 'react-native-paper';

// The mockups' Nunito weights, each a registered font file: the weight is the file (ADR-0012
// does not cover it; research R4), so `fontWeight` is never set.
const SEMI_BOLD = 'Nunito_600SemiBold';
const BOLD = 'Nunito_700Bold';
const EXTRA_BOLD = 'Nunito_800ExtraBold';

export type TypeRole = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

type PaperRole =
  | 'displayLarge'
  | 'displayMedium'
  | 'displaySmall'
  | 'headlineLarge'
  | 'headlineMedium'
  | 'headlineSmall'
  | 'titleLarge'
  | 'titleMedium'
  | 'titleSmall'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'labelLarge'
  | 'labelMedium'
  | 'labelSmall';

// Material's default display sizes, kept with the brand weight (data-model "Type scale").
const paperDefault = (
  role: 'displayLarge' | 'displayMedium' | 'displaySmall',
): TypeRole => {
  const { fontSize, lineHeight, letterSpacing } = MD3LightTheme.fonts[role];
  return { fontFamily: EXTRA_BOLD, fontSize, lineHeight, letterSpacing };
};

/** The mockup type scale, applied to every Paper MD3 role (data-model "Type scale"). */
export const typeScale: Record<PaperRole, TypeRole> = {
  displayLarge: paperDefault('displayLarge'),
  displayMedium: paperDefault('displayMedium'),
  displaySmall: paperDefault('displaySmall'),
  headlineLarge: { fontFamily: EXTRA_BOLD, fontSize: 32, lineHeight: 40 },
  headlineMedium: {
    fontFamily: EXTRA_BOLD,
    fontSize: 28,
    lineHeight: 35,
    letterSpacing: -0.2,
  },
  headlineSmall: { fontFamily: EXTRA_BOLD, fontSize: 24, lineHeight: 30 },
  titleLarge: {
    fontFamily: EXTRA_BOLD,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  titleMedium: { fontFamily: BOLD, fontSize: 16.5, lineHeight: 21 },
  titleSmall: {
    fontFamily: EXTRA_BOLD,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  bodyLarge: { fontFamily: SEMI_BOLD, fontSize: 16, lineHeight: 20 },
  bodyMedium: { fontFamily: SEMI_BOLD, fontSize: 15, lineHeight: 21.75 },
  bodySmall: { fontFamily: SEMI_BOLD, fontSize: 13, lineHeight: 16 },
  labelLarge: { fontFamily: EXTRA_BOLD, fontSize: 15.5, lineHeight: 19 },
  labelMedium: { fontFamily: BOLD, fontSize: 13, lineHeight: 16 },
  labelSmall: { fontFamily: BOLD, fontSize: 12.5, lineHeight: 16 },
};

/**
 * Mockup sizes outside the scale: each is a base role with its own size and, when it differs, its
 * family. Components never write a `fontSize` literal; they pick one of these or a role.
 */
export const typeOverrides = {
  quantity: { ...typeScale.labelMedium, fontSize: 13.5, fontFamily: BOLD },
  compactLabel: {
    ...typeScale.labelLarge,
    fontSize: 14.5,
    fontFamily: EXTRA_BOLD,
  },
  snackbarMessage: { ...typeScale.bodyMedium, fontSize: 15, fontFamily: BOLD },
  syncStrip: { ...typeScale.bodySmall, fontSize: 14, fontFamily: BOLD },
  emptyCategory: {
    ...typeScale.bodySmall,
    fontSize: 14,
    fontFamily: SEMI_BOLD,
  },
} satisfies Record<string, TypeRole>;
