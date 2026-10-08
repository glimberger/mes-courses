/**
 * @jest-environment node
 */
import { assertNoTestOptionsInProduction } from './release-guard.cjs';

const EU_DSN = 'https://key@o1.ingest.de.sentry.io/1';
const US_DSN = 'https://key@o1.ingest.us.sentry.io/1';
const OLD_US_DSN = 'https://key@o1.ingest.sentry.io/1';

const TEST_OPTIONS = [
  'EXPO_PUBLIC_SEED_ITEMS',
  'EXPO_PUBLIC_SENTRY_SMOKE_TEST',
  'STORYBOOK_ENABLED',
  'DETOX_BUILD',
];

const production = (env: Record<string, string | undefined> = {}) => ({
  EXPO_PUBLIC_APP_ENVIRONMENT: 'production',
  ...env,
});

describe('assertNoTestOptionsInProduction', () => {
  it('stops a production build with the measurement seed, naming EXPO_PUBLIC_SEED_ITEMS', () => {
    expect(() =>
      assertNoTestOptionsInProduction(
        production({ EXPO_PUBLIC_SEED_ITEMS: '200' }),
      ),
    ).toThrow(/EXPO_PUBLIC_SEED_ITEMS/);
  });

  it('names every test-only option set', () => {
    const run = () =>
      assertNoTestOptionsInProduction(
        production({
          EXPO_PUBLIC_SENTRY_SMOKE_TEST: '1',
          STORYBOOK_ENABLED: 'true',
        }),
      );

    expect(run).toThrow(/EXPO_PUBLIC_SENTRY_SMOKE_TEST/);
    expect(run).toThrow(/STORYBOOK_ENABLED/);
  });

  it('stops a production build made for the end-to-end tests, naming DETOX_BUILD', () => {
    expect(() =>
      assertNoTestOptionsInProduction(production({ DETOX_BUILD: '1' })),
    ).toThrow(/DETOX_BUILD/);
  });

  it.each([US_DSN, OLD_US_DSN])(
    'stops a production build whose Sentry DSN is outside the EU region (%s), naming the region',
    (dsn) => {
      expect(() =>
        assertNoTestOptionsInProduction(
          production({ EXPO_PUBLIC_SENTRY_DSN: dsn }),
        ),
      ).toThrow(/EU region/);
    },
  );

  it('stops a production build whose Sentry DSN is not an address', () => {
    expect(() =>
      assertNoTestOptionsInProduction(
        production({ EXPO_PUBLIC_SENTRY_DSN: 'not a dsn' }),
      ),
    ).toThrow(/EXPO_PUBLIC_SENTRY_DSN/);
  });

  it('lets a production build through with an EU DSN', () => {
    expect(() =>
      assertNoTestOptionsInProduction(
        production({ EXPO_PUBLIC_SENTRY_DSN: EU_DSN }),
      ),
    ).not.toThrow();
  });

  it('lets a production build through with no DSN', () => {
    expect(() => assertNoTestOptionsInProduction(production())).not.toThrow();
  });

  it('lets a production build through with every test-only option empty', () => {
    expect(() =>
      assertNoTestOptionsInProduction(
        production(
          Object.fromEntries(TEST_OPTIONS.map((option) => [option, ''])),
        ),
      ),
    ).not.toThrow();
  });

  it.each(['preview', 'development', undefined])(
    'lets a %p build through with every test-only option set',
    (environment) => {
      expect(() =>
        assertNoTestOptionsInProduction({
          EXPO_PUBLIC_APP_ENVIRONMENT: environment,
          EXPO_PUBLIC_SENTRY_DSN: US_DSN,
          ...Object.fromEntries(TEST_OPTIONS.map((option) => [option, '1'])),
        }),
      ).not.toThrow();
    },
  );
});
