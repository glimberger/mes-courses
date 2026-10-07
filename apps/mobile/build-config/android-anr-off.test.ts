/**
 * @jest-environment node
 */
import { AndroidConfig, type ExportedConfig } from 'expo/config-plugins';

import config from '../app.config';
import { turnOffAndroidAnr } from './android-anr-off.cjs';

const { getMainApplicationMetaDataValue } = AndroidConfig.Manifest;

const manifest = (): AndroidConfig.Manifest.AndroidManifest => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    queries: [],
    application: [{ $: { 'android:name': '.MainApplication' } }],
  },
});

describe('FR-030 Android ANR reports off', () => {
  it('sets io.sentry.anr.enable to false in the main application', () => {
    const result = turnOffAndroidAnr(manifest());

    expect(
      getMainApplicationMetaDataValue(result, 'io.sentry.anr.enable'),
    ).toBe('false');
  });

  it('keeps a single entry when applied twice', () => {
    const result = turnOffAndroidAnr(turnOffAndroidAnr(manifest()));

    expect(
      result.manifest.application?.[0]?.['meta-data']?.filter(
        (item) => item.$['android:name'] === 'io.sentry.anr.enable',
      ),
    ).toHaveLength(1);
  });

  it('is applied by the app config', () => {
    // No other part of app.config.ts adds an Android manifest mod; the string plugins (Sentry,
    // SQLite) are applied later, by prebuild.
    expect((config as ExportedConfig).mods?.android?.manifest).toEqual(
      expect.any(Function),
    );
  });
});
