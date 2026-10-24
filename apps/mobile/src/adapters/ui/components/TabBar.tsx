import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/spacing';
import type { AppTheme } from '../theme/theme';

/** The bar's height without the bottom inset (the mockups' `.tabbar`). */
export const TAB_BAR_HEIGHT = 80;

const PILL_WIDTH = 64;
const PILL_HEIGHT = 32;
const ICON_SIZE = 24;

export type TabBarItem = {
  key: string;
  /** Shown under the icon, and read by screen readers. */
  label: string;
  /** A Material Symbol name. */
  icon: string;
};

export type TabBarProps = {
  tabs: readonly TabBarItem[];
  selectedKey: string;
  /** Called for every press, on the selected tab too. */
  onSelect: (key: string) => void;
  testID?: string;
};

/**
 * The bottom bar of the four tabs (Material 3 navigation bar on surfaceContainer): an icon in a
 * 64 x 32 dp pill that is primaryContainer when selected, and a label under it. Presentational:
 * the navigator feeds it (`navigation.tsx`).
 */
export const TabBar = ({
  tabs,
  selectedKey,
  onSelect,
  testID,
}: TabBarProps): ReactNode => {
  const { colors } = useTheme() as AppTheme;
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surfaceContainer,
          paddingBottom: 16 + insets.bottom,
        },
      ]}
    >
      {tabs.map(({ key, label, icon }) => {
        const selected = key === selectedKey;
        return (
          <TouchableRipple
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={styles.tab}
          >
            <View style={styles.content}>
              <View
                testID={`tab-pill-${key}`}
                style={[
                  styles.pill,
                  {
                    backgroundColor: selected
                      ? colors.primaryContainer
                      : colors.surfaceContainer,
                  },
                ]}
              >
                <Icon
                  source={icon}
                  size={ICON_SIZE}
                  color={
                    selected
                      ? colors.onPrimaryContainer
                      : colors.onSurfaceVariant
                  }
                />
              </View>
              <Text
                variant="labelMedium"
                style={{
                  color: selected ? colors.onSurface : colors.onSurfaceVariant,
                }}
              >
                {label}
              </Text>
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    minHeight: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 12,
    paddingHorizontal: spacing.sm,
  },
  // The pill, its gap and the label make 52 dp: the minimum touch target is set all the same.
  tab: { flex: 1, minHeight: 48 },
  content: { alignItems: 'center', gap: spacing.xs },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
