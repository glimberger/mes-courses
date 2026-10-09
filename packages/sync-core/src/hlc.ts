import { compareStrings } from './compare';

/** Hybrid logical clock stamp (research R6). */
export type Hlc = { wallMs: number; counter: number; deviceId: string };

/** How far ahead of the server clock a stamp may be before it is clamped. */
export const MAX_CLOCK_AHEAD_MS = 60_000;

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 6;

/** Orders by `wallMs`, then `counter`, then `deviceId` (string order). */
export const compareHlc = (a: Hlc, b: Hlc): number =>
  a.wallMs - b.wallMs ||
  a.counter - b.counter ||
  compareStrings(a.deviceId, b.deviceId);

/** The snapshot stamp of a device: lower than any stamp it will ever make (R13). */
export const minHlc = (deviceId: string): Hlc => ({
  wallMs: 0,
  counter: 0,
  deviceId,
});

/** The stamp of a local change: follows the wall clock, never goes backwards. */
export const nextHlc = (state: Hlc, nowMs: number): Hlc => {
  const wallMs = Math.max(state.wallMs, nowMs);
  return {
    wallMs,
    counter: wallMs === state.wallMs ? state.counter + 1 : 0,
    deviceId: state.deviceId,
  };
};

/** Merges a remote stamp into the local state: the result is past both. */
export const receiveHlc = (state: Hlc, remote: Hlc, nowMs: number): Hlc => {
  const wallMs = Math.max(state.wallMs, remote.wallMs, nowMs);
  const fromState = wallMs === state.wallMs;
  const fromRemote = wallMs === remote.wallMs;
  const counter =
    fromState && fromRemote
      ? Math.max(state.counter, remote.counter) + 1
      : fromState
        ? state.counter + 1
        : fromRemote
          ? remote.counter + 1
          : 0;
  return { wallMs, counter, deviceId: state.deviceId };
};

/** Caps `wallMs` at `serverNowMs + 60 s`, so a clock set in the future wins only briefly. */
export const clampHlc = (hlc: Hlc, serverNowMs: number): Hlc => {
  const limit = serverNowMs + MAX_CLOCK_AHEAD_MS;
  return hlc.wallMs > limit ? { ...hlc, wallMs: limit } : hlc;
};

const WALL_MAX = 10 ** WALL_DIGITS - 1;
const COUNTER_MAX = 10 ** COUNTER_DIGITS - 1;
const ENCODED = new RegExp(
  `^(\\d{${WALL_DIGITS}})-(\\d{${COUNTER_DIGITS}})-(.+)$`,
  'su',
);

/**
 * A string for SQLite columns that sorts like `compareHlc`. Throws a `RangeError` for a stamp
 * the fixed-width format cannot hold, rather than writing a string that sorts wrongly.
 */
export const encodeHlc = (hlc: Hlc): string => {
  if (
    !Number.isInteger(hlc.wallMs) ||
    hlc.wallMs < 0 ||
    hlc.wallMs > WALL_MAX ||
    !Number.isInteger(hlc.counter) ||
    hlc.counter < 0 ||
    hlc.counter > COUNTER_MAX ||
    hlc.deviceId === ''
  ) {
    throw new RangeError('HLC out of range');
  }
  return `${String(hlc.wallMs).padStart(WALL_DIGITS, '0')}-${String(hlc.counter).padStart(COUNTER_DIGITS, '0')}-${hlc.deviceId}`;
};

/** The inverse of `encodeHlc`. Throws a `RangeError` on a malformed string. */
export const decodeHlc = (encoded: string): Hlc => {
  const [, wallMs, counter, deviceId] = ENCODED.exec(encoded) ?? [];
  if (wallMs === undefined || counter === undefined || deviceId === undefined) {
    throw new RangeError('Malformed HLC');
  }
  return { wallMs: Number(wallMs), counter: Number(counter), deviceId };
};
