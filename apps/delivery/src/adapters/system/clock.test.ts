import { createSystemClock } from './clock';

describe('system clock', () => {
  it('gives the current time in milliseconds', () => {
    const before = Date.now();
    const now = createSystemClock().nowMs();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
