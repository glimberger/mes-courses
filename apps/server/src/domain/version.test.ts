import { isBelow } from './version';

describe('isBelow', () => {
  it.each([
    ['1.0.0', '1.0.1', true],
    ['1.2.0', '1.10.0', true],
    ['0.9.9', '1.0.0', true],
    ['1.0.0', '1.0.0', false],
    ['2.0.0', '1.9.9', false],
    ['1.0.0-beta.1', '1.0.0', false],
    ['garbage', '1.0.0', true],
  ])('%s below %s: %s', (version, minimum, expected) => {
    expect(isBelow(version, minimum)).toBe(expected);
  });
});
