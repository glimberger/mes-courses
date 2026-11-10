import Constants from 'expo-constants';

import { ExpoAppInfo } from './expo-app-info';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: null },
}));

const setConfig = (config: unknown) => {
  (Constants as unknown as { expoConfig: unknown }).expoConfig = config;
};

describe('ExpoAppInfo', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_APP_ENVIRONMENT;
  });

  it('reads the version, the build number and the environment', () => {
    setConfig({ version: '2.1.0', android: { versionCode: 412 } });
    process.env.EXPO_PUBLIC_APP_ENVIRONMENT = 'staging';

    expect(new ExpoAppInfo().read()).toEqual({
      version: '2.1.0',
      build: 412,
      environment: 'staging',
    });
  });

  it('falls back to 0.0.0, no build and no environment when the build tells nothing', () => {
    setConfig(null);

    expect(new ExpoAppInfo().read()).toEqual({
      version: '0.0.0',
      build: null,
      environment: null,
    });
  });

  it('ignores an environment that is neither staging nor production', () => {
    setConfig({ version: '2.1.0' });
    process.env.EXPO_PUBLIC_APP_ENVIRONMENT = 'other';

    expect(new ExpoAppInfo().read().environment).toBeNull();
  });
});
