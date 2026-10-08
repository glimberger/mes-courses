// CommonJS JavaScript: Expo's config loader compiles app.config.ts but cannot require a
// TypeScript file from it.

/** Options that only test builds may set (spec Success Criteria, research R24). */
const TEST_ONLY_OPTIONS = [
  'EXPO_PUBLIC_SEED_ITEMS',
  'EXPO_PUBLIC_SENTRY_SMOKE_TEST',
  'STORYBOOK_ENABLED',
  'DETOX_BUILD',
];

/** The hosts of Sentry's EU region end so (research R25). */
const EU_HOST_SUFFIX = '.de.sentry.io';

/**
 * Why the DSN cannot go into a `production` build, or `null` when it can: no DSN at all, or one
 * in Sentry's EU region.
 *
 * @param {string | undefined} dsn
 * @returns {string | null}
 */
const dsnProblem = (dsn) => {
  if (!dsn) return null;
  let host;
  try {
    host = new URL(dsn).hostname;
  } catch {
    return 'EXPO_PUBLIC_SENTRY_DSN is not an address';
  }
  return host.endsWith(EU_HOST_SUFFIX)
    ? null
    : `EXPO_PUBLIC_SENTRY_DSN points at ${host}, outside Sentry's EU region (a host ending in ${EU_HOST_SUFFIX})`;
};

/**
 * Stops a `production` build, while its configuration is read, when it would carry a test-only
 * option or send reports outside Sentry's EU region; the error names each option to unset or the
 * address to replace (research R24, R25). Other builds pass whatever they set.
 *
 * @param {Record<string, string | undefined>} env
 */
const assertNoTestOptionsInProduction = (env) => {
  if (env.EXPO_PUBLIC_APP_ENVIRONMENT !== 'production') return;
  const problems = TEST_ONLY_OPTIONS.filter((option) => env[option]).map(
    (option) => `${option} is a test-only option`,
  );
  const dsn = dsnProblem(env.EXPO_PUBLIC_SENTRY_DSN);
  if (dsn) problems.push(dsn);
  if (problems.length > 0) {
    throw new Error(
      `This production build cannot be made: ${problems.join('; ')}.`,
    );
  }
};

module.exports = { assertNoTestOptionsInProduction };
