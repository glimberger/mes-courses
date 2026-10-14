import type { AccountRecord } from '../../domain/account';
import type { ErrorReporter } from '../ports/error-reporter';

/**
 * Password hashing is deliberately slow, and the store runs one transaction at a time, so a use
 * case that checks or sets a password reads in a short transaction, hashes outside any
 * transaction, then decides in a second one. The account may change in between: the decision
 * only goes ahead when the fields the hashes depend on are still what the first read saw, and
 * starts again otherwise.
 */
export const MAX_HASHING_ROUNDS = 3;

/** True when nothing a password check depends on changed between two reads of an account. */
export const sameCredentials = (
  before: AccountRecord | null,
  after: AccountRecord | null,
): boolean =>
  before === null || after === null
    ? before === after
    : before.id === after.id &&
      before.email === after.email &&
      before.passwordHash === after.passwordHash &&
      before.temporaryPasswordHash === after.temporaryPasswordHash &&
      before.temporaryExpiresAt === after.temporaryExpiresAt &&
      before.suspendedAt === after.suspendedAt;

/**
 * Reports that every round found the account changed, just before the use case refuses. The
 * caller sees a plain refusal, so this is the only trace of a user who may have given the right
 * credentials. Fixed identifiers only, no request content.
 */
export const reportExhaustedRounds = (
  reporter: ErrorReporter | undefined,
  operation: string,
  route: string,
  accountId?: string,
): void =>
  reporter?.report(
    new Error(
      `Credentials changed during all ${MAX_HASHING_ROUNDS} hashing rounds`,
    ),
    { operation, route, ...(accountId === undefined ? {} : { accountId }) },
  );
