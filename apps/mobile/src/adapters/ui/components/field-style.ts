import type { AppTheme } from '../theme/theme';
import { shape } from '../theme/shape';

const OUTLINE_WIDTH = 1.5;

/**
 * The outlined field of the mockups, as Paper `TextInput` props: a 1.5 dp outline, the radius of
 * its context (16 dp on screens, 14 dp in dialogs), and the text and label roles.
 */
export const fieldStyle = (context: 'screen' | 'dialog', theme: AppTheme) => {
  const { colors } = theme;
  return {
    mode: 'outlined' as const,
    // The label sits in the top border even when the field is empty (Paper patch, README).
    labelFloated: true,
    outlineStyle: {
      borderRadius: context === 'screen' ? shape.lg : shape.field,
      borderWidth: OUTLINE_WIDTH,
    },
    outlineColor: colors.outline,
    activeOutlineColor: colors.primary,
    textColor: colors.onSurface,
    // The typed text and its placeholder take the bodyLarge family (SC-003).
    style: { fontFamily: theme.fonts.bodyLarge.fontFamily },
    theme: {
      ...theme,
      colors: {
        ...theme.colors,
        onSurfaceVariant: colors.onSurfaceVariant,
        // Paper fills the field, and the gap its label cuts in the outline, with `background`:
        // inside a dialog that is the dialog's own surface.
        background:
          context === 'dialog'
            ? colors.surfaceContainerLowest
            : colors.background,
      },
    },
  };
};
