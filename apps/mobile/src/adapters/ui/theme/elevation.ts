import { rgba, type AppTheme } from './theme';

// Soft two-layer shadows of the mockups (styles.css --shadow-card, --shadow-fab), built as
// React Native boxShadow strings from theme roles only (research R3). Layers stack from the
// first to the last, so the tight layer comes first.
const layer = (
  color: string,
  alpha: number,
  offsetY: number,
  blur: number,
): string => `0px ${offsetY}px ${blur}px ${rgba(color, alpha)}`;

/** The shadow tokens of a theme: one `boxShadow` value per surface that lifts off the page. */
export const shadows = (theme: AppTheme) => {
  const { colors, dark } = theme;
  const [cardTight, cardSoft] = dark ? [0.35, 0.3] : [0.05, 0.06];
  return {
    card: [
      layer(colors.shadow, cardTight, 1, 2),
      layer(colors.shadow, cardSoft, 6, 16),
    ].join(', '),
    fab: [
      layer(colors.onPrimaryContainer, 0.2, 4, 12),
      layer(colors.onPrimaryContainer, 0.14, 1, 3),
    ].join(', '),
    dialog: [
      layer(colors.shadow, 0.24, 14, 36),
      layer(colors.shadow, 0.12, 2, 6),
    ].join(', '),
    snackbar: [
      layer(colors.scrim, 0.26, 6, 18),
      layer(colors.scrim, 0.16, 1, 3),
    ].join(', '),
    brandTile: layer(colors.onPrimaryContainer, 0.14, 10, 28),
  };
};
