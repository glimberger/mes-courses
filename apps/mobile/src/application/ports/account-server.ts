import type {
  AccountInfo,
  Pairing,
  PasswordProblem,
} from '@mes-courses/sync-core';

import type { Result } from '../../domain/result';
import type {
  Connection,
  ServerUnreachable,
  SyncFailure,
  TooManyAttempts,
  UntrustedServer,
  UpdateRequired,
} from './sync-server';

/** Unknown address or wrong password: the server never says which (FR-006). */
export type InvalidCredentials = { type: 'InvalidCredentials' };
/** The temporary password typed is valid but past its 7 days. */
export type TemporaryPasswordExpired = { type: 'TemporaryPasswordExpired' };
export type AccountSuspended = { type: 'AccountSuspended' };
/** The new password breaks a rule the server checks. */
export type PasswordRejected = {
  type: 'PasswordRejected';
  problem: PasswordProblem;
};

/** A device the server just authorized, with the account it belongs to. */
export type AccountPairing = Pairing & { accountId: string };

export type SignInOutcome =
  | { type: 'signedIn'; pairing: AccountPairing; account: AccountInfo }
  | { type: 'passwordChangeRequired' };

export type SignInServerError =
  | InvalidCredentials
  | TemporaryPasswordExpired
  | AccountSuspended
  | TooManyAttempts
  | ServerUnreachable
  | UntrustedServer
  | UpdateRequired;

export type ChoosePasswordServerError =
  | InvalidCredentials
  | TemporaryPasswordExpired
  | AccountSuspended
  | PasswordRejected
  | TooManyAttempts
  | ServerUnreachable
  | UntrustedServer
  | UpdateRequired;

export type PasswordResetServerError =
  | InvalidEmailRefused
  | TooManyAttempts
  | ServerUnreachable
  | UntrustedServer
  | UpdateRequired;

/** The server refused the address as malformed (the app checks it first). */
export type InvalidEmailRefused = { type: 'InvalidEmail' };

/**
 * The HTTP adapter for the caller's own account, over the same transport as `SyncServer`. Grows
 * story by story: the password reset and the account's own changes come with US4 and US6.
 */
export interface AccountServer {
  signIn(
    url: string,
    email: string,
    password: string,
    deviceName: string,
  ): Promise<Result<SignInOutcome, SignInServerError>>;
  choosePassword(
    url: string,
    email: string,
    temporaryPassword: string,
    newPassword: string,
    deviceName: string,
  ): Promise<Result<AccountPairing, ChoosePasswordServerError>>;
  /** Asks for a new temporary password by email; the answer is the same for any address. */
  requestPasswordReset(
    url: string,
    email: string,
  ): Promise<Result<void, PasswordResetServerError>>;
  getAccount(conn: Connection): Promise<Result<AccountInfo, SyncFailure>>;
}
