import { compareSemver, parseSemver } from './semver';

describe('parseSemver', () => {
  it('parses a release', () => {
    expect(parseSemver('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      staging: null,
    });
  });

  it('parses a staging prerelease', () => {
    expect(parseSemver('1.2.0-staging.412')).toEqual({
      major: 1,
      minor: 2,
      patch: 0,
      staging: 412,
    });
  });

  it.each([
    '',
    '1.2',
    '1.2.3.4',
    'v1.2.3',
    '1.2.3-beta.1',
    '1.2.3-staging.',
    '1.2.3-staging',
    '01.2.3',
    '1.2.x',
    ' 1.2.3',
  ])('rejects %p', (input) => {
    expect(() => parseSemver(input)).toThrow(/semver/i);
  });
});

describe('compareSemver', () => {
  it('is 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('1.2.0-staging.4', '1.2.0-staging.4')).toBe(0);
  });

  it('orders by major, then minor, then patch, numerically', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareSemver('1.2.3', '1.2.10')).toBeLessThan(0);
  });

  it('puts a prerelease below the same release', () => {
    expect(compareSemver('1.2.0-staging.9', '1.2.0')).toBeLessThan(0);
    expect(compareSemver('1.2.0', '1.2.0-staging.9')).toBeGreaterThan(0);
  });

  it('orders prereleases of one version by their number', () => {
    expect(
      compareSemver('1.2.0-staging.10', '1.2.0-staging.9'),
    ).toBeGreaterThan(0);
  });

  it('puts a prerelease of a higher version above a lower release', () => {
    expect(compareSemver('1.3.0-staging.1', '1.2.9')).toBeGreaterThan(0);
  });
});
