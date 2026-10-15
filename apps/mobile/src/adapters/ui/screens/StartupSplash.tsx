import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';

import { FullScreen } from './FullScreen';

/** The non-interactive presentation shown while local composition is pending. */
export const StartupSplash = () => {
  const [assetFailed, setAssetFailed] = useState(false);

  return (
    <FullScreen>
      <SafeAreaView style={styles.container}>
        {assetFailed ? (
          <Text accessibilityRole="header" variant="headlineLarge">
            Mes Courses
          </Text>
        ) : (
          <Image
            accessible
            accessibilityLabel="Mes Courses"
            accessibilityRole="image"
            onError={() => setAssetFailed(true)}
            resizeMode="contain"
            source={require('../../../../assets/splash-screen.png')}
            style={styles.image}
            testID="startup-splash-image"
          />
        )}
      </SafeAreaView>
    </FullScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    flex: 1,
  },
});
