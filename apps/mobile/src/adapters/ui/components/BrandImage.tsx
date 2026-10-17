import type { ReactNode } from 'react';
import { Image, StyleSheet } from 'react-native';

export type BrandImageProps = {
  onError: () => void;
};

/**
 * The logo at a fixed size. Image ignores width and height props: they go through its style, or
 * the logo shows at its native size.
 */
export const BrandImage = ({ onError }: BrandImageProps): ReactNode => (
  <Image
    accessible
    accessibilityLabel="Mes Courses"
    accessibilityRole="image"
    onError={onError}
    resizeMode="contain"
    source={require('../../../../assets/splash-screen.png')}
    style={styles.image}
    testID="sign-in-brand-image"
  />
);

const styles = StyleSheet.create({
  image: { height: 96, width: 96 },
});
