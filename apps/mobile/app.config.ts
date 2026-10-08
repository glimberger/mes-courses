import type { ExpoConfig } from 'expo/config';

import { withAndroidAnrOff } from './build-config/android-anr-off.cjs';
import { withAndroidNoMinify } from './build-config/android-no-minify.cjs';

// Detox's native changes (test runner, cleartext traffic to the emulator host) go only into
// builds made for the end-to-end tests (research R23, R25).
const detoxBuild = process.env.DETOX_BUILD === '1';

const config: ExpoConfig = {
  name: 'Mes courses',
  slug: 'mes-courses',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    // Store identity: permanent once the app is first uploaded to a store.
    bundleIdentifier: 'com.glimberger.mescourses',
    supportsTablet: true,
  },
  plugins: [
    'expo-sqlite',
    '@sentry/react-native/expo',
    ...(detoxBuild ? ['expo-detox-config-plugin'] : []),
  ],
  android: {
    package: 'com.glimberger.mescourses',
    // The system backup keeps the data (research R18b): no backup rule excludes the database.
    allowBackup: true,
    // FR-041: no permission of its own; INTERNET stays because React Native declares it.
    permissions: [],
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.VIBRATE',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
};

// A plugin given as a function is applied here: `plugins` only types names.
export default withAndroidNoMinify(withAndroidAnrOff(config));
