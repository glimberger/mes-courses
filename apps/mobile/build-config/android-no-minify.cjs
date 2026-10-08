// CommonJS JavaScript: Expo's config loader compiles app.config.ts but cannot require a
// TypeScript file from it.
const { withGradleProperties } = require('expo/config-plugins');

const MINIFY = 'android.enableMinifyInReleaseBuilds';

/**
 * Keeps Android release builds unminified, as they were before Expo SDK 58 turned R8 on by
 * default: R8 strips classes only reached by reflection, which the end-to-end builds already
 * showed, and a build users get must be the one the journeys test (research R1, R23).
 *
 * @param {import('expo/config-plugins').AndroidConfig.Properties.PropertiesItem[]} properties
 */
const turnOffMinify = (properties) => [
  ...properties.filter(
    (item) => !(item.type === 'property' && item.key === MINIFY),
  ),
  { type: /** @type {const} */ ('property'), key: MINIFY, value: 'false' },
];

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withAndroidNoMinify = (config) =>
  withGradleProperties(config, (propertiesConfig) => {
    propertiesConfig.modResults = turnOffMinify(propertiesConfig.modResults);
    return propertiesConfig;
  });

module.exports = { turnOffMinify, withAndroidNoMinify };
