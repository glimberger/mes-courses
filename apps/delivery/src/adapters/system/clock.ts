import type { Clock } from '../../application/ports/clock';

export const createSystemClock = (): Clock => ({ nowMs: () => Date.now() });
