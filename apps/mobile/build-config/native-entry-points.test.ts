/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** The native files' content once every config plugin ran, as `expo prebuild` would write it. */
type ModResults = {
  ios: { infoPlist: Record<string, unknown> };
  android: {
    manifest: {
      manifest: {
        'uses-permission'?: { $: Record<string, string> }[];
        application?: {
          activity?: {
            $: Record<string, string>;
            'intent-filter'?: {
              action?: { $: Record<string, string> }[];
              category?: { $: Record<string, string> }[];
              data?: unknown[];
            }[];
          }[];
        }[];
      };
    };
  };
};

const BLOCKED_PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.VIBRATE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

/**
 * Runs Expo's own CLI in introspection mode, which computes the native configuration without
 * writing files (research R25). It complements native-surface.test.ts, which reads the config
 * before plugins run.
 */
const introspect = (): ModResults => {
  const appRoot = path.resolve(__dirname, '..');
  const output = execFileSync(
    process.execPath,
    [
      require.resolve('expo/bin/cli', { paths: [appRoot] }),
      'config',
      '--type',
      'introspect',
      '--json',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      // A test-only option set in the shell would change the config, or stop it.
      env: {
        ...process.env,
        DETOX_BUILD: '',
        STORYBOOK_ENABLED: '',
        EXPO_PUBLIC_APP_ENVIRONMENT: '',
      },
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  return (JSON.parse(output) as { _internal: { modResults: ModResults } })
    ._internal.modResults;
};

describe('FR-041 native entry points of the app, after config plugins', () => {
  let modResults: ModResults;

  beforeAll(() => {
    modResults = introspect();
  }, 60_000);

  it('FR-041 declares no iOS URL scheme', () => {
    expect(modResults.ios.infoPlist).not.toHaveProperty('CFBundleURLTypes');
  });

  it('FR-041 declares no iOS usage description', () => {
    expect(
      Object.keys(modResults.ios.infoPlist).filter((key) =>
        key.endsWith('UsageDescription'),
      ),
    ).toEqual([]);
  });

  it('FR-041 declares only INTERNET as an Android permission, and removes the blocked ones', () => {
    const permissions =
      modResults.android.manifest.manifest['uses-permission'] ?? [];

    expect(
      permissions
        .filter((permission) => permission.$['tools:node'] !== 'remove')
        .map((permission) => permission.$['android:name']),
    ).toEqual(['android.permission.INTERNET']);
    expect(
      permissions
        .filter((permission) => permission.$['tools:node'] === 'remove')
        .map((permission) => permission.$['android:name'])
        .sort(),
    ).toEqual([...BLOCKED_PERMISSIONS].sort());
  });

  it('FR-041 declares no Android intent filter but the launcher', () => {
    const filters = (modResults.android.manifest.manifest.application ?? [])
      .flatMap((application) => application.activity ?? [])
      .flatMap((activity) => activity['intent-filter'] ?? [])
      .map((filter) => ({
        actions: (filter.action ?? []).map(
          (action) => action.$['android:name'],
        ),
        categories: (filter.category ?? []).map(
          (category) => category.$['android:name'],
        ),
        data: filter.data ?? [],
      }));

    expect(filters).toEqual([
      {
        actions: ['android.intent.action.MAIN'],
        categories: ['android.intent.category.LAUNCHER'],
        data: [],
      },
    ]);
  });
});
