export const CODE_LIFETIME_MS = 10 * 60 * 1000;
/** The rolling window in which failed claims are counted (FR-019b). */
export const FAILURE_WINDOW_MS = 10 * 60 * 1000;
export const MAX_FAILURES_IN_WINDOW = 5;

export const DEVICE_NAME_MAX = 60;

/** The trimmed name, or `null` when it is not 1–60 characters. */
export const cleanDeviceName = (name: string): string | null => {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= DEVICE_NAME_MAX
    ? trimmed
    : null;
};

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
