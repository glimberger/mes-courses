/**
 * @jest-environment node
 */
import type { AndroidConfig } from 'expo/config-plugins';

import { turnOffMinify } from './android-no-minify.cjs';

type Properties = AndroidConfig.Properties.PropertiesItem[];

/** The gradle.properties Expo SDK 58 generates: release builds minified. */
const sdk58Properties = (): Properties => [
  { type: 'comment', value: 'The app is optimized using R8.' },
  {
    type: 'property',
    key: 'android.enableMinifyInReleaseBuilds',
    value: 'true',
  },
  { type: 'property', key: 'newArchEnabled', value: 'true' },
];

const valueOf = (properties: Properties, key: string) =>
  properties.find(
    (item): item is Extract<typeof item, { type: 'property' }> =>
      item.type === 'property' && item.key === key,
  )?.value;

describe('Android release builds not minified', () => {
  it('sets android.enableMinifyInReleaseBuilds to false, keeping the other properties', () => {
    const result = turnOffMinify(sdk58Properties());

    expect(valueOf(result, 'android.enableMinifyInReleaseBuilds')).toBe(
      'false',
    );
    expect(valueOf(result, 'newArchEnabled')).toBe('true');
  });

  it('adds the property when it is missing, once', () => {
    const result = turnOffMinify(turnOffMinify([]));

    expect(
      result.filter(
        (item) =>
          item.type === 'property' &&
          item.key === 'android.enableMinifyInReleaseBuilds',
      ),
    ).toEqual([
      {
        type: 'property',
        key: 'android.enableMinifyInReleaseBuilds',
        value: 'false',
      },
    ]);
  });
});
