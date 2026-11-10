import { normalizeEmail } from '@mes-courses/sync-core';

import { err, type Result } from '../../domain/result';
import type { AccountServer } from '../ports/account-server';
import type {
  ServerUnreachable,
  TooManyAttempts,
  UntrustedServer,
  UpdateRequired,
} from '../ports/sync-server';
import type { InvalidEmail } from './sign-in';

export type RequestPasswordResetError =
  | InvalidEmail
  | TooManyAttempts
  | ServerUnreachable
  | UntrustedServer
  | UpdateRequired;

/**
 * Asks the fixed server (013) for a new temporary password (US4-1). A malformed email is refused here,
 * without a request. Success is the same whether the account exists or not, so the person is
 * told nothing about which addresses have one (US4-3).
 */
export const createRequestPasswordReset =
  ({
    accountServer,
    serverUrl: url,
  }: {
    accountServer: AccountServer;
    /** The sync server address fixed at build time, already validated (013). */
    serverUrl: string;
  }) =>
  async (
    typedEmail: string,
  ): Promise<Result<void, RequestPasswordResetError>> => {
    const email = normalizeEmail(typedEmail);
    if (email === null) return err({ type: 'InvalidEmail' });
    return accountServer.requestPasswordReset(url, email);
  };
