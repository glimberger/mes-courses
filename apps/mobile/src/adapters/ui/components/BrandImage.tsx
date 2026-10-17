import type { ReactNode } from 'react';
import { Image, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

import { shadows } from '../theme/elevation';
import type { AppTheme } from '../theme/theme';

// The mockups' brand tile (`.brand-tile`): a 215 dp square with 40 dp corners.
const TILE = 215;
const RADIUS = 40;

export type BrandImageProps = {
  onError: () => void;
};

/**
 * The brand tile of the sign-in screen: the logo cropped to a 215 dp square with the brand shadow.
 * Image ignores width and height props: they go through its style, or the logo shows at its
 * native size.
 */
export const BrandImage = ({ onError }: BrandImageProps): ReactNode => {
  const theme = useTheme() as AppTheme;
  return (
    <Image
      accessible
      accessibilityLabel="Mes Courses"
      accessibilityRole="image"
      onError={onError}
      resizeMode="cover"
      source={require('../../../../assets/splash-screen.png')}
      style={[styles.image, { boxShadow: shadows(theme).brandTile }]}
      testID="sign-in-brand-image"
    />
  );
};

const styles = StyleSheet.create({
  image: { width: TILE, height: TILE, borderRadius: RADIUS },
});
