import { normalizeEmail } from '@mes-courses/sync-core';

import { err, type Result } from '../../domain/result';
import type { AccountServer } from '../ports/account-server';
import type {
  ServerUnreachable,
  TooManyAttempts,
  UntrustedServer,
  UpdateRequired,
} from '../ports/sync-server';
import { normalizeUrl } from './normalize-url';
import type { InvalidEmail } from './sign-in';
import type { InvalidUrl } from './store-signed-in-device';

export type RequestPasswordResetError =
  | InvalidUrl
  | InvalidEmail
  | TooManyAttempts
  | ServerUnreachable
  | UntrustedServer
  | UpdateRequired;

/**
 * Asks the server for a new temporary password (US4-1). A malformed address is refused here,
 * without a request. Success is the same whether the account exists or not, so the person is
 * told nothing about which addresses have one (US4-3).
 */
export const createRequestPasswordReset =
  ({
    accountServer,
    allowInsecure = false,
  }: {
    accountServer: AccountServer;
    /** Accepts `http://` addresses; set by the composition in development builds only. */
    allowInsecure?: boolean;
  }) =>
  async (
    typedUrl: string,
    typedEmail: string,
  ): Promise<Result<void, RequestPasswordResetError>> => {
    const url = normalizeUrl(typedUrl, allowInsecure);
    if (url === null) return err({ type: 'InvalidUrl' });
    const email = normalizeEmail(typedEmail);
    if (email === null) return err({ type: 'InvalidEmail' });
    return accountServer.requestPasswordReset(url, email);
  };
