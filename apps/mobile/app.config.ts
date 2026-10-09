import type { ExpoConfig } from 'expo/config';

import { withAndroidAnrOff } from './build-config/android-anr-off.cjs';
import { withAndroidNoMinify } from './build-config/android-no-minify.cjs';
import { withNoUrlSchemes } from './build-config/no-url-schemes.cjs';
import { assertNoTestOptionsInProduction } from './build-config/release-guard.cjs';

// A `production` build stops here when it carries a test-only option or a DSN outside the EU
// (research R24, R25).
assertNoTestOptionsInProduction(process.env);

// Detox's native changes (test runner, cleartext traffic to the emulator host) go only into
// builds made for the end-to-end tests (research R23, R25).
const detoxBuild = process.env.DETOX_BUILD === '1';

const config: ExpoConfig = {
  name: 'Mes courses',
  slug: 'mes-courses',
  // Semantic versioning, set by hand in the pull request that leads to a release (research R24);
  // the build number is EAS's, remote and incremented on every build.
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
    // The credential is excluded from Android's Auto Backup, while the database stays in it
    // (003 research R12a, with 001's `allowBackup: true`). No biometrics, so no Face ID usage
    // description (FR-041).
    [
      'expo-secure-store',
      { configureAndroidBackup: true, faceIDPermission: false },
    ],
    // Source maps and native debug files are uploaded during EAS Build (research R13). The
    // organization and project come from SENTRY_ORG and SENTRY_PROJECT, and the credential from
    // SENTRY_AUTH_TOKEN, all EAS environment variables; the organization is in the EU region.
    ['@sentry/react-native/expo', { url: 'https://de.sentry.io/' }],
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

// A plugin given as a function is applied here: `plugins` only types names. The URL schemes are
// removed last, after every plugin that could add one (FR-041).
export default withNoUrlSchemes(withAndroidNoMinify(withAndroidAnrOff(config)));
