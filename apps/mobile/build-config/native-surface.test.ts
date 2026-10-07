/**
 * @jest-environment node
 */
import path from 'node:path';

import { getConfig, type ExpoConfig } from '@expo/config';

const REQUIRED_BLOCKED_PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.VIBRATE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

describe('FR-041 native surface of the app', () => {
  let exp: ExpoConfig;

  beforeAll(() => {
    ({ exp } = getConfig(path.resolve(__dirname, '..'), {
      skipSDKVersionRequirement: true,
      skipPlugins: true,
    }));
  });

  it('FR-041 declares no Android permission of its own', () => {
    expect(exp.android?.permissions).toEqual([]);
  });

  it.each(REQUIRED_BLOCKED_PERMISSIONS)(
    'FR-041 blocks %s, which libraries add on their own',
    (permission) => {
      expect(exp.android?.blockedPermissions ?? []).toContain(permission);
    },
  );

  it('FR-041 sets no URL scheme, so no other app can open it', () => {
    expect(exp.scheme).toBeUndefined();
  });

  it('FR-041 sets no Android intent filter', () => {
    expect(exp.android?.intentFilters).toBeUndefined();
  });

  it('FR-041 sets no iOS usage description', () => {
    const names = Object.keys(exp.ios?.infoPlist ?? {});
    expect(names.filter((name) => name.endsWith('UsageDescription'))).toEqual(
      [],
    );
  });
});
