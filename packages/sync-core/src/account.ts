const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordProblem =
  'TooShort' | 'TooLong' | 'SameAsTemporary' | 'SameAsCurrent';

/** Trimmed and lower-cased, or `null` when it is not a valid address (research R13). */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email)) return null;
  return email;
}

/** A temporary password is compared in upper case, without dashes or spaces (research R3). */
export function normalizeTemporaryPassword(raw: string): string {
  return raw.normalize('NFC').replace(/[-\s]/g, '').toUpperCase();
}

/**
 * 12 to 128 code points after NFC, any character, no trimming (FR-005, research R3).
 * `previous.temporary` is the password just used to sign in; `previous.current` the one being changed.
 */
export function validateNewPassword(
  password: string,
  previous?: { temporary: string } | { current: string },
): PasswordProblem | null {
  const normalized = password.normalize('NFC');
  const length = [...normalized].length;
  if (length < MIN_PASSWORD_LENGTH) return 'TooShort';
  if (length > MAX_PASSWORD_LENGTH) return 'TooLong';
  if (previous && 'temporary' in previous) {
    if (
      normalizeTemporaryPassword(normalized) ===
      normalizeTemporaryPassword(previous.temporary)
    ) {
      return 'SameAsTemporary';
    }
  } else if (previous && normalized === previous.current.normalize('NFC')) {
    return 'SameAsCurrent';
  }
  return null;
}
