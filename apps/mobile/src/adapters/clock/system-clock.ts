import type { Clock } from '../../application/ports/clock';

/** The device's wall clock. */
export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }
}
