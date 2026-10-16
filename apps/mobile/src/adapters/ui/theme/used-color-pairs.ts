import type { SchemeRole } from './theme';

/**
 * A foreground role drawn on a background role. Text needs 4.5:1 and every other foreground
 * (icons, checkbox, outline) 3:1 (FR-036, WCAG 2.2 AA).
 */
export interface UsedColorPair {
  foreground: SchemeRole;
  background: SchemeRole;
  kind: 'text' | 'graphic';
}

const BACKGROUNDS: readonly SchemeRole[] = [
  'surface',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
];

const onEveryBackground = (
  foreground: SchemeRole,
  kind: UsedColorPair['kind'],
): UsedColorPair[] =>
  BACKGROUNDS.map((background) => ({ foreground, background, kind }));

/**
 * Every pair the screens and shared components draw, checked in light and dark by
 * theme.test.ts. A task that draws a new role, or on a new background, adds its pair here.
 */
export const usedColorPairs: readonly UsedColorPair[] = [
  // Text, ticked rows' muted text (onSurfaceVariant), text buttons (primary).
  ...onEveryBackground('onSurface', 'text'),
  ...onEveryBackground('onSurfaceVariant', 'text'),
  ...onEveryBackground('primary', 'text'),
  ...onEveryBackground('error', 'text'),
  // An unticked checkbox and outlined fields.
  ...onEveryBackground('outline', 'graphic'),
  // The FAB's label and icon (ScreenFab), the current-list badge and brand markers.
  {
    foreground: 'onPrimaryContainer',
    background: 'primaryContainer',
    kind: 'text',
  },
  // Brand-toned circular settings/dialog icons on the soft brand surface proxy.
  {
    foreground: 'primary',
    background: 'surfaceContainerHigh',
    kind: 'graphic',
  },
  // Green "Déjà dans la liste" chip (ArticleRow).
  {
    foreground: 'onTertiaryContainer',
    background: 'tertiaryContainer',
    kind: 'text',
  },
  // Destructive dialog icons and confirm buttons on their circle.
  {
    foreground: 'onErrorContainer',
    background: 'errorContainer',
    kind: 'text',
  },
];
