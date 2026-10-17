import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppTheme } from '../theme/theme';
import { BackAction } from './BackAction';

// The mockups' header measures (`.appbar`, `.appbar.center`), off the 4 dp grid.
const TOP = 14;
const BOTTOM = 10;
const LARGE_START = 20;
const LARGE_END = 8;
const CENTER_SIDES = 16;
const CHIP_GAP = 6;
const ACTION_SIZE = 48;

export type ScreenHeaderProps = {
  title: string;
  /** `large`: a start-aligned title with optional chip and actions. `center`: a centered title. */
  variant?: 'large' | 'center';
  /** headlineMedium for a large title (the default); titleLarge for a title in a smaller bar. */
  titleVariant?: 'headlineMedium' | 'titleLarge';
  /** A line under the title, 6 dp below it (the list's remaining count). */
  chip?: ReactNode;
  /** Trailing actions, in the order given. */
  actions?: ReactNode;
  /** Shows the "Retour" action at the start. */
  onBack?: () => void;
  testID?: string;
};

/**
 * The screen title bar: it starts below the status bar, the title is a header for assistive
 * technology and wraps instead of truncating (FR-013).
 */
export const ScreenHeader = ({
  title,
  variant = 'large',
  titleVariant,
  chip,
  actions,
  onBack,
  testID,
}: ScreenHeaderProps) => {
  const { colors } = useTheme() as AppTheme;
  const insets = useSafeAreaInsets();
  const back = onBack ? <BackAction onPress={onBack} /> : null;

  if (variant === 'center') {
    return (
      <View
        testID={testID}
        style={[styles.center, { paddingTop: insets.top + TOP }]}
      >
        {back ?? <View style={styles.spacer} />}
        <Text
          variant={titleVariant ?? 'titleLarge'}
          accessibilityRole="header"
          style={[styles.centerTitle, { color: colors.onSurface }]}
        >
          {title}
        </Text>
        <View style={styles.spacer} />
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[styles.large, { paddingTop: insets.top + TOP }]}
    >
      {back}
      <View style={styles.titles}>
        <Text
          variant={titleVariant ?? 'headlineMedium'}
          accessibilityRole="header"
          style={[styles.largeTitle, { color: colors.onSurface }]}
        >
          {title}
        </Text>
        {chip ? <View style={styles.chip}>{chip}</View> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: BOTTOM,
    paddingStart: LARGE_START,
    paddingEnd: LARGE_END,
  },
  titles: { flex: 1, alignItems: 'flex-start' },
  largeTitle: { textAlign: 'left' },
  chip: { marginTop: CHIP_GAP },
  actions: { flexDirection: 'row' },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: BOTTOM,
    paddingHorizontal: CENTER_SIDES,
  },
  centerTitle: { flex: 1, textAlign: 'center' },
  spacer: { width: ACTION_SIZE, height: ACTION_SIZE },
});
