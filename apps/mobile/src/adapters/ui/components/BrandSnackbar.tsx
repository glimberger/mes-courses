import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Snackbar, Text, useTheme } from 'react-native-paper';

import { shadows } from '../theme/elevation';
import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';
import { typeOverrides } from '../theme/typography';

// The mockups' snackbar (`.snackbar`): a 56 dp bar, 16 dp from the sides.
const MIN_HEIGHT = 56;
const SIDES_MARGIN = 16;

export type BrandSnackbarProps = ComponentProps<typeof Snackbar>;

/**
 * Paper's snackbar in the mockups' look: an inverseSurface bar with 16 dp corners and the snackbar
 * shadow, its message in the snackbarMessage role and its action at compactLabel size. The message
 * wraps (FR-033) and the action stays at its end.
 */
export const BrandSnackbar = ({
  children,
  style,
  action,
  ...props
}: BrandSnackbarProps) => {
  const theme = useTheme() as AppTheme;
  const { colors } = theme;
  return (
    <Snackbar
      {...props}
      style={[
        styles.bar,
        {
          backgroundColor: colors.inverseSurface,
          boxShadow: shadows(theme).snackbar,
        },
        style,
      ]}
      contentStyle={styles.content}
      {...(action && {
        action: {
          ...action,
          labelStyle: {
            fontFamily: typeOverrides.compactLabel.fontFamily,
            fontSize: typeOverrides.compactLabel.fontSize,
          },
        },
      })}
    >
      <Text
        style={{
          color: colors.inverseOnSurface,
          fontFamily: typeOverrides.snackbarMessage.fontFamily,
          fontSize: typeOverrides.snackbarMessage.fontSize,
        }}
      >
        {children}
      </Text>
    </Snackbar>
  );
};

const styles = StyleSheet.create({
  bar: {
    minHeight: MIN_HEIGHT,
    borderRadius: shape.lg,
    marginHorizontal: SIDES_MARGIN,
    paddingTop: 8,
    paddingBottom: 8,
    paddingStart: 18,
    paddingEnd: 6,
  },
  content: { marginHorizontal: 0, marginVertical: 0 },
});
