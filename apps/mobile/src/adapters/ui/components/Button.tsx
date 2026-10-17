import { forwardRef, type ReactNode, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  type HostInstance,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import { shape } from '../theme/shape';
import type { AppTheme, SchemeRole } from '../theme/theme';
import { typeOverrides } from '../theme/typography';

export type ButtonMode =
  'brand' | 'outlined' | 'danger' | 'dangerFilled' | 'text';

// Paper's former mode names, still used by callers: a contained button is the brand button.
type LegacyMode = 'contained' | 'contained-tonal' | 'elevated';

export type ButtonProps = {
  mode?: ButtonMode | LegacyMode;
  /** `compact` is 44 dp high, for dialogs and inline actions; the default is 50 dp. */
  size?: 'default' | 'compact';
  /** A Material Symbol name drawn at 20 dp before the label. */
  icon?: string;
  disabled?: boolean;
  onPress?: () => void;
  /** Overrides the mode's fill, for the callers that still pick a role themselves. */
  buttonColor?: string;
  /** Overrides the mode's text and icon color. */
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
};

type Palette = {
  background?: SchemeRole;
  foreground: SchemeRole;
  border?: SchemeRole;
  paddingHorizontal: number;
};

const PALETTES: Record<ButtonMode, Palette> = {
  brand: {
    background: 'primaryContainer',
    foreground: 'onPrimaryContainer',
    paddingHorizontal: 24,
  },
  outlined: {
    foreground: 'primary',
    border: 'outline',
    paddingHorizontal: 24,
  },
  danger: {
    foreground: 'error',
    border: 'error',
    paddingHorizontal: 24,
  },
  dangerFilled: {
    background: 'error',
    foreground: 'onError',
    paddingHorizontal: 24,
  },
  text: {
    foreground: 'primary',
    paddingHorizontal: 14,
  },
};

const LEGACY_MODES: Record<LegacyMode, ButtonMode> = {
  contained: 'brand',
  'contained-tonal': 'brand',
  elevated: 'brand',
};

const isLegacyMode = (mode: ButtonMode | LegacyMode): mode is LegacyMode =>
  mode in LEGACY_MODES;

// The 20 dp icon of the mockups' `.btn` (research R6).
const ICON_SIZE = 20;
const BORDER_WIDTH = 1.5;
const DEFAULT_HEIGHT = 50;
const COMPACT_HEIGHT = 44;
// A compact button is 44 dp; a 2 dp hit slop on each side makes its target 48 dp (FR-034).
const COMPACT_HIT_SLOP = { top: 2, bottom: 2 };

/**
 * The mockups' pill button, in the five modes of the design (brand, outlined, danger,
 * dangerFilled, text). Paper's contained modes map to brand. Its label is the button's name.
 */
export const Button = forwardRef<View, ButtonProps>(
  (
    {
      mode = 'brand',
      size = 'default',
      icon,
      disabled = false,
      onPress,
      buttonColor,
      textColor,
      style,
      testID,
      children,
    },
    ref,
  ) => {
    const { colors } = useTheme() as AppTheme;
    const resolved = isLegacyMode(mode) ? LEGACY_MODES[mode] : mode;
    const palette = PALETTES[resolved];
    const compact = size === 'compact';
    const foreground = textColor ?? colors[palette.foreground];
    const background =
      buttonColor ??
      (palette.background ? colors[palette.background] : 'transparent');

    return (
      <Pressable
        // Callers pass refs typed as Paper types them (see paper-ref.ts).
        ref={ref as unknown as Ref<HostInstance>}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        hitSlop={compact ? COMPACT_HIT_SLOP : undefined}
        style={[
          styles.button,
          compact ? styles.compact : styles.default,
          {
            paddingHorizontal: palette.paddingHorizontal,
            backgroundColor: background,
          },
          palette.border && styles.bordered,
          palette.border && { borderColor: colors[palette.border] },
          disabled && styles.disabled,
          style,
        ]}
      >
        {icon ? (
          <Icon source={icon} size={ICON_SIZE} color={foreground} />
        ) : null}
        <Text
          variant="labelLarge"
          style={[
            { color: foreground },
            compact || resolved === 'text' ? styles.compactLabel : null,
          ]}
        >
          {children}
        </Text>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: shape.pill,
  },
  compact: { height: COMPACT_HEIGHT },
  default: { height: DEFAULT_HEIGHT },
  bordered: { borderWidth: BORDER_WIDTH },
  disabled: { opacity: 0.5 },
  compactLabel: { fontSize: typeOverrides.compactLabel.fontSize },
});

Button.displayName = 'Button';
