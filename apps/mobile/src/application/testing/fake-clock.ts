import type { Clock } from '../ports/clock';

/** A clock the test moves by hand; it starts at 0. */
export class FakeClock implements Clock {
  constructor(private ms = 0) {}

  nowMs(): number {
    return this.ms;
  }

  set(ms: number): void {
    this.ms = ms;
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}
