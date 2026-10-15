/**
 * @jest-environment node
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { androidVersionCode, appVariant } from './app-variant.cjs';

const MOBILE = join(__dirname, '..');

/** Width and height from the IHDR chunk of a PNG. */
const pngSize = (file: string) => {
  const bytes = readFileSync(file);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

describe('appVariant', () => {
  it('is the production identity when APP_VARIANT is unset', () => {
    expect(appVariant({})).toEqual({
      name: 'Mes courses',
      package: 'com.glimberger.mescourses',
      icon: './assets/icon.png',
      adaptiveForeground: './assets/android-icon-foreground.png',
      adaptiveMonochrome: './assets/android-icon-monochrome.png',
      splashImage: './assets/splash-screen.png',
    });
  });

  it('is a separate "test" identity for staging', () => {
    expect(appVariant({ APP_VARIANT: 'staging' })).toEqual({
      name: 'Mes courses (test)',
      package: 'com.glimberger.mescourses.staging',
      icon: './assets/staging/icon.png',
      adaptiveForeground: './assets/staging/android-icon-foreground.png',
      adaptiveMonochrome: './assets/staging/android-icon-monochrome.png',
      splashImage: './assets/splash-screen.png',
    });
  });

  it('refuses any other value', () => {
    expect(() => appVariant({ APP_VARIANT: 'preview' })).toThrow(/APP_VARIANT/);
    expect(() => appVariant({ APP_VARIANT: 'production' })).toThrow(
      /APP_VARIANT/,
    );
  });

  it('names an icon that exists, of the production size, for the staging variant', () => {
    const staging = appVariant({ APP_VARIANT: 'staging' });
    const production = appVariant({});
    for (const key of [
      'icon',
      'adaptiveForeground',
      'adaptiveMonochrome',
      'splashImage',
    ] as const) {
      const file = join(MOBILE, staging[key]);
      expect(existsSync(file)).toBe(true);
      expect(pngSize(file)).toEqual(pngSize(join(MOBILE, production[key])));
    }
  });
});

describe('androidVersionCode', () => {
  it('is undefined when ANDROID_VERSION_CODE is unset or empty', () => {
    expect(androidVersionCode({})).toBeUndefined();
    expect(androidVersionCode({ ANDROID_VERSION_CODE: '' })).toBeUndefined();
  });

  it('is the number when set', () => {
    expect(androidVersionCode({ ANDROID_VERSION_CODE: '412' })).toBe(412);
  });

  it.each(['0', '-3', '4.5', 'abc', '12x'])('throws for %s', (value) => {
    expect(() => androidVersionCode({ ANDROID_VERSION_CODE: value })).toThrow(
      /ANDROID_VERSION_CODE/,
    );
  });
});
