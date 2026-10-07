import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Mes courses',
  slug: 'mes-courses',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
  },
  plugins: ['expo-sqlite', '@sentry/react-native/expo'],
  android: {
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

export default config;
