import { SystemClock } from './system-clock';

describe('SystemClock', () => {
  afterEach(() => jest.useRealTimers());

  it('returns Date.now()', () => {
    jest.useFakeTimers().setSystemTime(1_760_000_000_123);

    expect(new SystemClock().nowMs()).toBe(1_760_000_000_123);
  });
});
