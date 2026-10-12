export const CODE_LIFETIME_MS = 10 * 60 * 1000;
/** The rolling window in which failed claims are counted (FR-019b). */
export const FAILURE_WINDOW_MS = 10 * 60 * 1000;
export const MAX_FAILURES_IN_WINDOW = 5;

// Moved to device.ts; re-exported until pairing is removed.
export { cleanDeviceName, DEVICE_NAME_MAX } from './device';

/**
 * Seconds a caller must wait before the failure window drops below the limit: the oldest failure
 * that still counts leaves the window after `FAILURE_WINDOW_MS`. At least 1.
 */
export const retryAfterSeconds = (
  nowMs: number,
  earliestFailureMs: number,
): number =>
  Math.max(
    1,
    Math.ceil((earliestFailureMs + FAILURE_WINDOW_MS - nowMs) / 1000),
  );
