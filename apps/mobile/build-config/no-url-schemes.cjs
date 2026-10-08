// CommonJS JavaScript: Expo's config loader compiles app.config.ts but cannot require a
// TypeScript file from it.
const { withInfoPlist } = require('expo/config-plugins');

/**
 * Removes every URL scheme from the iOS Info.plist. `expo prebuild` adds the bundle identifier as
 * one, an entry point FR-041 forbids: no other app may open this one (research R25).
 *
 * @param {Record<string, unknown>} infoPlist
 */
const removeUrlSchemes = (infoPlist) => {
  const rest = { ...infoPlist };
  delete rest.CFBundleURLTypes;
  return rest;
};

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withNoUrlSchemes = (config) =>
  withInfoPlist(config, (plistConfig) => {
    plistConfig.modResults = /** @type {typeof plistConfig.modResults} */ (
      removeUrlSchemes(plistConfig.modResults)
    );
    return plistConfig;
  });

module.exports = { removeUrlSchemes, withNoUrlSchemes };
