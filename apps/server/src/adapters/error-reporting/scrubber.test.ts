import { REDACTED, scrubAddresses, scrubError } from './scrubber';

describe('scrubAddresses', () => {
  it('004 R10 removes an address from a message', () => {
    expect(
      scrubAddresses('could not send to marie.dupont@example.org now'),
    ).toBe(`could not send to ${REDACTED} now`);
  });

  it('004 R10 removes several addresses, and an address closing a sentence', () => {
    expect(scrubAddresses('a@b.fr and c.d+e@f.g.org.')).toBe(
      `${REDACTED} and ${REDACTED}.`,
    );
  });

  it('004 R10 removes an address inside a URL, plain or percent-encoded, and keeps the rest of it', () => {
    expect(scrubAddresses('https://x.fr/v1?email=marie@example.org&a=1')).toBe(
      `https://x.fr/v1?email=${REDACTED}&a=1`,
    );
    expect(scrubAddresses('https://x.fr/?e=marie%40example.org')).toBe(
      `https://x.fr/?e=${REDACTED}`,
    );
  });

  it('004 R10 removes an address with non-ASCII characters, and the domain with it', () => {
    expect(scrubAddresses('josé@exemple.fr')).toBe(REDACTED);
    expect(scrubAddresses('MARIE@EXAMPLE.ORG')).toBe(REDACTED);
  });

  it('004 R10 removes an address whose domain ends in a non-ASCII or punycode label', () => {
    expect(scrubAddresses('marie@exemple.рф')).toBe(REDACTED);
    expect(scrubAddresses('marie@exemple.xn--p1ai')).toBe(REDACTED);
  });

  it('004 R10 leaves a package folder of a stack trace untouched', () => {
    const frame =
      'at x (/app/node_modules/.pnpm/jest-circus@30.5.2_supports-color@8.1.1/node_modules/y.js:1:2)';
    expect(scrubAddresses(frame)).toBe(frame);
  });

  it('004 R10 stays fast on a long text without an address', () => {
    const text = 'a'.repeat(100_000);
    const started = Date.now();
    expect(scrubAddresses(text)).toBe(text);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('004 R10 leaves text without an address untouched', () => {
    const text = 'POST /v1/sync failed at 12:30 (user@host is not an address)';
    expect(scrubAddresses(text)).toBe(text);
  });
});

describe('scrubError', () => {
  it('004 R10 returns the same error when it has nothing to scrub', () => {
    const error = new Error('boom');

    expect(scrubError(error)).toBe(error);
  });

  it('004 R10 scrubs the message and the stack, keeping the name', () => {
    const error = new TypeError('failed for marie@example.org');

    const clean = scrubError(error) as Error;

    expect(clean).toBeInstanceOf(Error);
    expect(clean.name).toBe('TypeError');
    expect(clean.message).toBe(`failed for ${REDACTED}`);
    expect(clean.stack).not.toContain('marie@');
  });

  it('004 R10 scrubs a nested cause', () => {
    const error = new Error('outer', {
      cause: new Error('inner for paul@example.org'),
    });

    const clean = scrubError(error) as Error;

    expect(clean.message).toBe('outer');
    expect((clean.cause as Error).message).toBe(`inner for ${REDACTED}`);
  });

  it('004 R10 scrubs a string and leaves other values alone', () => {
    expect(scrubError('for a@b.fr')).toBe(`for ${REDACTED}`);
    const value = { code: 1 };
    expect(scrubError(value)).toBe(value);
    expect(scrubError(undefined)).toBeUndefined();
  });
});
