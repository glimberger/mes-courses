import { decideLocalCopy } from './local-copy-rule';

describe('decideLocalCopy', () => {
  it.each([
    ['the same account', 'acc-1', 'https://s.example', 'acc-1', 'keep'],
    ['the same account, never synced to a url', 'acc-1', null, 'acc-1', 'keep'],
    ['an anonymous, never-connected copy', null, null, 'acc-1', 'keep'],
    ['another account', 'acc-2', 'https://s.example', 'acc-1', 'erase'],
    ['another account without a url', 'acc-2', null, 'acc-1', 'erase'],
    [
      'a connection with no known account',
      null,
      'https://s.example',
      'acc-1',
      'erase',
    ],
  ] as const)(
    '004 FR-017 %s -> %s',
    (_name, copyAccount, copyUrl, signingIn, expected) => {
      expect(decideLocalCopy(copyAccount, copyUrl, signingIn)).toBe(expected);
    },
  );
});
