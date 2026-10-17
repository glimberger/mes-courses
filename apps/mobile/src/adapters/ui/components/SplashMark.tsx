import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { shadows } from '../theme/elevation';
import type { AppTheme } from '../theme/theme';

// The mockups' splash (`.splash`): a 208 dp brand tile, a 42 dp gap, a 96 × 5 progress track.
const IMAGE = 208;
const IMAGE_RADIUS = 44;
const GAP = 42;
const TRACK_WIDTH = 96;
const TRACK_HEIGHT = 5;
const TRACK_RADIUS = 3;
const BAR_WIDTH = 38;
const BAR_OFFSET = 18;

export type SplashMarkProps = {
  /** Whether the brand image failed to load: the name is then shown as text. */
  assetFailed: boolean;
  onError: () => void;
};

/** The brand tile and the progress track of the startup splash, centered by the screen. */
export const SplashMark = ({
  assetFailed,
  onError,
}: SplashMarkProps): ReactNode => {
  const theme = useTheme() as AppTheme;
  const { colors } = theme;
  return (
    <View style={styles.mark} testID="startup-splash-mark">
      {assetFailed ? (
        <Text accessibilityRole="header" variant="headlineLarge">
          Mes Courses
        </Text>
      ) : (
        <Image
          accessible
          accessibilityLabel="Mes Courses"
          accessibilityRole="image"
          onError={onError}
          resizeMode="cover"
          source={require('../../../../assets/splash-screen.png')}
          style={[styles.image, { boxShadow: shadows(theme).brandTile }]}
          testID="startup-splash-image"
        />
      )}
      <View
        importantForAccessibility="no-hide-descendants"
        style={[styles.track, { backgroundColor: colors.surfaceContainer }]}
        testID="startup-splash-progress"
      >
        <View
          style={[styles.bar, { backgroundColor: colors.primaryContainer }]}
          testID="startup-splash-progress-bar"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mark: { alignItems: 'center', gap: GAP },
  image: { width: IMAGE, height: IMAGE, borderRadius: IMAGE_RADIUS },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    overflow: 'hidden',
  },
  bar: {
    width: BAR_WIDTH,
    height: '100%',
    borderRadius: TRACK_RADIUS,
    marginLeft: BAR_OFFSET,
  },
});
