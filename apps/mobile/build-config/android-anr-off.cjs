// CommonJS JavaScript: Expo's config loader compiles app.config.ts but cannot require a
// TypeScript file from it.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const { addMetaDataItemToMainApplication, getMainApplicationOrThrow } =
  AndroidConfig.Manifest;

/**
 * Turns off the Android SDK's ANR reports. They are built in native code, so they skip the
 * JavaScript filter and carry the installation id, and `enableAppHangTracking` only reaches iOS.
 * The Android SDK reads this entry before the React Native options, which never change it
 * (FR-030, research R13).
 *
 * @param {import('expo/config-plugins').AndroidConfig.Manifest.AndroidManifest} androidManifest
 */
const turnOffAndroidAnr = (androidManifest) => {
  addMetaDataItemToMainApplication(
    getMainApplicationOrThrow(androidManifest),
    'io.sentry.anr.enable',
    'false',
  );
  return androidManifest;
};

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withAndroidAnrOff = (config) =>
  withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = turnOffAndroidAnr(manifestConfig.modResults);
    return manifestConfig;
  });

module.exports = { turnOffAndroidAnr, withAndroidAnrOff };
