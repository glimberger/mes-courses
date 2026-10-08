// Detox drives the release build of the app (research R23). The builds carry no Sentry DSN, no
// Storybook, and the Detox native changes only because DETOX_BUILD=1.
const APP_DIR = '../../apps/mobile';
// Name of the Xcode workspace and scheme that `expo prebuild` generates for the app.
const IOS_PROJECT = 'Mescourses';

// The whole build chain (prebuild, then Gradle or Xcode) runs in one shell with this environment,
// so that Sentry's build steps see SENTRY_DISABLE_AUTO_UPLOAD too.
const build = (commands) =>
  `cd ${APP_DIR} && env -u EXPO_PUBLIC_SENTRY_DSN -u STORYBOOK_ENABLED DETOX_BUILD=1 SENTRY_DISABLE_AUTO_UPLOAD=true sh -c '${commands}'`;

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'jest.config.js' },
    jest: { setupTimeout: 120000 },
  },
  artifacts: {
    rootDir: 'artifacts',
    plugins: {
      log: { enabled: true, keepOnlyFailedTestsArtifacts: true },
      screenshot: {
        enabled: true,
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: true,
        takeWhen: { testStart: false, testDone: true },
      },
      video: { enabled: false },
      instruments: { enabled: false },
      uiHierarchy: 'disabled',
    },
  },
  apps: {
    'android.release': {
      type: 'android.apk',
      // Only the app module: assembleAndroidTest at the root also builds every library's debug
      // test APK, which fails on duplicate native libraries since React Native 0.88.
      build: build(
        'yarn expo prebuild --platform android && cd android && ./gradlew :app:assembleRelease :app:assembleAndroidTest -DtestBuildType=release',
      ),
      binaryPath: `${APP_DIR}/android/app/build/outputs/apk/release/app-release.apk`,
      testBinaryPath: `${APP_DIR}/android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk`,
    },
    'ios.release': {
      type: 'ios.app',
      build: build(
        `yarn expo prebuild --platform ios && xcodebuild -workspace ios/${IOS_PROJECT}.xcworkspace -scheme ${IOS_PROJECT} -configuration Release -sdk iphonesimulator -derivedDataPath ios/build`,
      ),
      binaryPath: `${APP_DIR}/ios/build/Build/Products/Release-iphonesimulator/${IOS_PROJECT}.app`,
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: { avdName: process.env.DETOX_AVD_NAME ?? 'Pixel_API_35' },
      // Cold boot when Detox starts the emulator itself (locally). From a quick-boot snapshot,
      // the emulator reports booted at once, then drops its adb connection a moment later, while
      // Detox installs the app. In CI the emulator runner boots it first, so this is unused.
      bootArgs: '-no-snapshot-load',
    },
    simulator: {
      type: 'ios.simulator',
      device: {
        type: process.env.DETOX_IOS_DEVICE ?? 'iPhone 16',
        // Set DETOX_IOS_OS (for example 'iOS 26.5') when several runtimes have the same device.
        ...(process.env.DETOX_IOS_OS ? { os: process.env.DETOX_IOS_OS } : {}),
      },
    },
  },
  configurations: {
    'android.emu.release': { device: 'emulator', app: 'android.release' },
    'ios.sim.release': { device: 'simulator', app: 'ios.release' },
  },
};
