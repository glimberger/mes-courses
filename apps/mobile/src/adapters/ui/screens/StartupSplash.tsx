import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SplashMark } from '../components/SplashMark';

import { FullScreen } from './FullScreen';

/** The non-interactive presentation shown while local composition is pending. */
export const StartupSplash = () => {
  const [assetFailed, setAssetFailed] = useState(false);

  return (
    <FullScreen>
      <SafeAreaView testID="startup-splash-container" style={styles.container}>
        <SplashMark
          assetFailed={assetFailed}
          onError={() => setAssetFailed(true)}
        />
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
});
