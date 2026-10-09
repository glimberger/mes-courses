import type { Clock } from '../../application/ports/clock';

export const systemClock: Clock = { nowMs: () => Date.now() };
