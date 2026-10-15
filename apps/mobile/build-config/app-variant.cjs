// CommonJS JavaScript: Expo's config loader compiles app.config.ts but cannot require a
// TypeScript file from it.

const PRODUCTION = {
  name: 'Mes courses',
  package: 'com.glimberger.mescourses',
  icon: './assets/icon.png',
  adaptiveForeground: './assets/android-icon-foreground.png',
  adaptiveMonochrome: './assets/android-icon-monochrome.png',
  splashImage: './assets/splash-screen.png',
};

// Same art with a "test" badge, installable next to the production app (research R14, FR-003).
const STAGING = {
  name: 'Mes courses (test)',
  package: 'com.glimberger.mescourses.staging',
  icon: './assets/staging/icon.png',
  adaptiveForeground: './assets/staging/android-icon-foreground.png',
  adaptiveMonochrome: './assets/staging/android-icon-monochrome.png',
  splashImage: './assets/splash-screen.png',
};

/**
 * The identity of the build: `APP_VARIANT=staging` or unset (production). Any other value throws,
 * so a typo cannot silently ship the production identity.
 *
 * @param {Record<string, string | undefined>} env
 */
const appVariant = (env) => {
  const variant = env.APP_VARIANT;
  if (variant === undefined || variant === '') return PRODUCTION;
  if (variant === 'staging') return STAGING;
  throw new Error(
    `APP_VARIANT must be "staging" or unset, got ${JSON.stringify(variant)}`,
  );
};

/**
 * The Android `versionCode` imposed by CI (the commit's position on main, research R7), or
 * `undefined` to leave it to the build tool.
 *
 * @param {Record<string, string | undefined>} env
 */
const androidVersionCode = (env) => {
  const raw = env.ANDROID_VERSION_CODE;
  if (raw === undefined || raw === '') return undefined;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(
      `ANDROID_VERSION_CODE must be a positive integer, got ${JSON.stringify(raw)}`,
    );
  }
  return Number(raw);
};

module.exports = { appVariant, androidVersionCode };
