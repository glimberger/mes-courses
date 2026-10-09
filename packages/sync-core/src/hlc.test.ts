import {
  clampHlc,
  compareHlc,
  decodeHlc,
  encodeHlc,
  minHlc,
  nextHlc,
  receiveHlc,
  type Hlc,
} from './hlc';

const hlc = (wallMs: number, counter: number, deviceId: string): Hlc => ({
  wallMs,
  counter,
  deviceId,
});

describe('compareHlc', () => {
  it('R6 orders by wallMs first', () => {
    expect(compareHlc(hlc(1, 9, 'z'), hlc(2, 0, 'a'))).toBeLessThan(0);
    expect(compareHlc(hlc(2, 0, 'a'), hlc(1, 9, 'z'))).toBeGreaterThan(0);
  });

  it('R6 then by counter', () => {
    expect(compareHlc(hlc(5, 1, 'z'), hlc(5, 2, 'a'))).toBeLessThan(0);
  });

  it('R6 then by deviceId', () => {
    expect(compareHlc(hlc(5, 1, 'a'), hlc(5, 1, 'b'))).toBeLessThan(0);
    expect(compareHlc(hlc(5, 1, 'b'), hlc(5, 1, 'b'))).toBe(0);
  });
});

describe('nextHlc', () => {
  it('R6 follows the wall clock when it moves forward, with the counter back to 0', () => {
    expect(nextHlc(hlc(100, 4, 'd'), 150)).toEqual(hlc(150, 0, 'd'));
  });

  it('R6 bumps the counter when the wall clock stalls', () => {
    expect(nextHlc(hlc(100, 4, 'd'), 100)).toEqual(hlc(100, 5, 'd'));
  });

  it('R6 bumps the counter when the wall clock goes back, never moving backwards', () => {
    const next = nextHlc(hlc(100, 4, 'd'), 40);
    expect(next).toEqual(hlc(100, 5, 'd'));
    expect(compareHlc(next, hlc(100, 4, 'd'))).toBeGreaterThan(0);
  });
});

describe('receiveHlc', () => {
  it('R6 never goes backwards when the remote stamp is older', () => {
    const state = hlc(100, 3, 'd');
    const received = receiveHlc(state, hlc(50, 9, 'other'), 60);
    expect(compareHlc(received, state)).toBeGreaterThan(0);
    expect(received).toEqual(hlc(100, 4, 'd'));
  });

  it('R6 jumps past a remote stamp that is ahead', () => {
    const remote = hlc(500, 2, 'other');
    const received = receiveHlc(hlc(100, 3, 'd'), remote, 120);
    expect(compareHlc(received, remote)).toBeGreaterThan(0);
    expect(received).toEqual(hlc(500, 3, 'd'));
  });

  it('R6 follows the wall clock when it is ahead of both', () => {
    expect(receiveHlc(hlc(100, 3, 'd'), hlc(200, 2, 'o'), 900)).toEqual(
      hlc(900, 0, 'd'),
    );
  });

  it('R6 takes the greater counter plus one when both stamps share the wall time', () => {
    expect(receiveHlc(hlc(100, 3, 'd'), hlc(100, 8, 'o'), 50)).toEqual(
      hlc(100, 9, 'd'),
    );
    expect(receiveHlc(hlc(100, 8, 'd'), hlc(100, 3, 'o'), 50)).toEqual(
      hlc(100, 9, 'd'),
    );
  });
});

describe('minHlc', () => {
  it('R13 is the zero stamp of the device', () => {
    expect(minHlc('d')).toEqual(hlc(0, 0, 'd'));
  });

  it('R13 is lower than any stamp made by nextHlc', () => {
    expect(compareHlc(minHlc('d'), nextHlc(minHlc('d'), 1))).toBeLessThan(0);
  });
});

describe('clampHlc', () => {
  it('R6 keeps a stamp at most 60 s ahead of the server clock', () => {
    const stamp = hlc(1_060_000, 3, 'd');
    expect(clampHlc(stamp, 1_000_000)).toEqual(stamp);
  });

  it('R6 caps wallMs at serverNowMs + 60_000 and keeps the rest', () => {
    expect(clampHlc(hlc(9_000_000, 3, 'd'), 1_000_000)).toEqual(
      hlc(1_060_000, 3, 'd'),
    );
  });
});

describe('encodeHlc / decodeHlc', () => {
  it('refuses a stamp the fixed-width format cannot hold', () => {
    expect(() => encodeHlc(hlc(1, 1_000_000, 'd'))).toThrow(RangeError);
    expect(() => encodeHlc(hlc(1, -1, 'd'))).toThrow(RangeError);
    expect(() => encodeHlc(hlc(1, 1.5, 'd'))).toThrow(RangeError);
    expect(() => encodeHlc(hlc(10 ** 15, 0, 'd'))).toThrow(RangeError);
    expect(() => encodeHlc(hlc(1, 0, ''))).toThrow(RangeError);
  });

  it.each(['', 'abc', '000000000000001-000001', '00000000000000x-000001-d'])(
    'refuses to decode the malformed string "%s"',
    (text) => {
      expect(() => decodeHlc(text)).toThrow(RangeError);
    },
  );

  it('decodes what it encodes, with a deviceId holding dashes', () => {
    const stamp = hlc(1_760_000_000_123, 42, '0b9e-4c1f-aa');
    expect(decodeHlc(encodeHlc(stamp))).toEqual(stamp);
  });

  it('gives strings that sort like compareHlc', () => {
    const stamps = [
      hlc(10, 0, 'b'),
      hlc(9, 99, 'z'),
      hlc(10, 0, 'a'),
      hlc(1_760_000_000_000, 0, 'a'),
      hlc(10, 1, 'a'),
      hlc(0, 0, 'a'),
    ];
    const byCompare = [...stamps].sort(compareHlc);
    const byString = [...stamps].sort((a, b) => {
      const [x, y] = [encodeHlc(a), encodeHlc(b)];
      return x < y ? -1 : x > y ? 1 : 0;
    });
    expect(byString).toEqual(byCompare);
  });
});
