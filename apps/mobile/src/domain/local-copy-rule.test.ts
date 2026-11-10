import { decideLocalCopy } from './local-copy-rule';

describe('decideLocalCopy', () => {
  it.each([
    ['the same account', 'acc-1', 'device-1', 'acc-1', 'keep'],
    ['the same account, never paired', 'acc-1', null, 'acc-1', 'keep'],
    ['an anonymous, never-paired copy', null, null, 'acc-1', 'keep'],
    ['another account', 'acc-2', 'device-1', 'acc-1', 'erase'],
    ['another account without a pairing', 'acc-2', null, 'acc-1', 'erase'],
    ['a pairing with no known account', null, 'device-1', 'acc-1', 'erase'],
  ] as const)(
    '004 FR-017 013 %s -> %s',
    (_name, copyAccount, copyDeviceId, signingIn, expected) => {
      expect(decideLocalCopy(copyAccount, copyDeviceId, signingIn)).toBe(
        expected,
      );
    },
  );
});
