const ADDRESS_CHARACTERS = String.raw`[^\s@<>"'()\[\],;:=&?/\\]`;
const AT = '(?:@|%40)';
/** Anything that looks like an email address, in plain text or percent-encoded in a URL. */
// Each run is capped at the 254 characters of the longest address: unbounded runs made a long text
// without an address cost quadratic time.
const ADDRESS = new RegExp(
  `${ADDRESS_CHARACTERS}{1,254}${AT}${ADDRESS_CHARACTERS}{1,254}\\.${ADDRESS_CHARACTERS}{1,254}(?<!\\.)`,
  'gi',
);

export const REDACTED = '[email]';

/** The text with every email-looking part replaced (research R10, a second line after not putting one there). */
export const scrubAddresses = (text: string): string =>
  text.replace(ADDRESS, REDACTED);

const MAX_CAUSE_DEPTH = 5;

/**
 * The error with its message, stack and causes scrubbed. An error with nothing to scrub is
 * returned as it is, so a reporter still sends the original object.
 */
export const scrubError = (error: unknown, depth = 0): unknown => {
  if (typeof error === 'string') return scrubAddresses(error);
  if (!(error instanceof Error) || depth > MAX_CAUSE_DEPTH) return error;

  const message = scrubAddresses(error.message);
  const stack =
    error.stack === undefined ? undefined : scrubAddresses(error.stack);
  const cause = scrubError(error.cause, depth + 1);
  if (
    message === error.message &&
    stack === error.stack &&
    cause === error.cause
  ) {
    return error;
  }
  const clean = new Error(message, cause === undefined ? undefined : { cause });
  clean.name = error.name;
  if (stack !== undefined) clean.stack = stack;
  return clean;
};
