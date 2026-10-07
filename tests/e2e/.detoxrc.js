// Detox drives the release build of the app (research R23). The builds carry no Sentry DSN, no
// Storybook, and the Detox native changes only because DETOX_BUILD=1.
const APP_DIR = '../../apps/mobile';
// Name of the Xcode workspace and scheme that `expo prebuild` generates for the app.
const IOS_PROJECT = 'Mescourses';

const buildEnv =
  'env -u EXPO_PUBLIC_SENTRY_DSN -u STORYBOOK_ENABLED DETOX_BUILD=1 SENTRY_DISABLE_AUTO_UPLOAD=true';

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
      build: `cd ${APP_DIR} && ${buildEnv} yarn expo prebuild --platform android && cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release`,
      binaryPath: `${APP_DIR}/android/app/build/outputs/apk/release/app-release.apk`,
      testBinaryPath: `${APP_DIR}/android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk`,
    },
    'ios.release': {
      type: 'ios.app',
      build: `cd ${APP_DIR} && ${buildEnv} yarn expo prebuild --platform ios && xcodebuild -workspace ios/${IOS_PROJECT}.xcworkspace -scheme ${IOS_PROJECT} -configuration Release -sdk iphonesimulator -derivedDataPath ios/build`,
      binaryPath: `${APP_DIR}/ios/build/Build/Products/Release-iphonesimulator/${IOS_PROJECT}.app`,
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: { avdName: process.env.DETOX_AVD_NAME ?? 'Pixel_API_35' },
    },
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 16' },
    },
  },
  configurations: {
    'android.emu.release': { device: 'emulator', app: 'android.release' },
    'ios.sim.release': { device: 'simulator', app: 'ios.release' },
  },
};
