import type { AccountInfo, PasswordProblem } from '@mes-courses/sync-core';

import type {
  AccountPairing,
  AccountServer,
  ChoosePasswordServerError,
  SignInServerError,
} from '../../application/ports/account-server';
import { err, ok, type Result } from '../../domain/result';
import {
  createSend,
  errorCode,
  minutesToWait,
  syncFailure,
  transportFailure,
  type Answer,
  type TransportOptions,
} from './transport';

const isAccountInfo = (value: unknown): value is AccountInfo =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AccountInfo).id === 'string' &&
  typeof (value as AccountInfo).email === 'string' &&
  ((value as AccountInfo).role === 'user' ||
    (value as AccountInfo).role === 'administrator');

const PASSWORD_PROBLEMS: readonly string[] = [
  'TooShort',
  'TooLong',
  'SameAsTemporary',
  'SameAsCurrent',
] satisfies PasswordProblem[];

const isAccountPairing = (
  body: unknown,
): body is AccountPairing & {
  account: AccountInfo;
} =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as AccountPairing).deviceId === 'string' &&
  typeof (body as AccountPairing).credential === 'string' &&
  typeof (body as AccountPairing).serverId === 'string' &&
  typeof (body as AccountPairing).apiVersion === 'number' &&
  typeof (body as AccountPairing).minAppVersion === 'string' &&
  typeof (body as AccountPairing).accountId === 'string' &&
  isAccountInfo((body as { account?: unknown }).account);

/**
 * The failures the two unauthenticated auth routes share. Anything unexpected reads as an
 * unreachable server, as 003's claim did: the user can only try again.
 */
const authFailure = (
  answer: Answer,
): Result<never, SignInServerError & ChoosePasswordServerError> | null => {
  if (answer.kind === 'untrusted') return err({ type: 'UntrustedServer' });
  if (answer.kind === 'unreachable') return err({ type: 'ServerUnreachable' });
  switch (answer.status) {
    case 401:
      return errorCode(answer.body) === 'TemporaryPasswordExpired'
        ? err({ type: 'TemporaryPasswordExpired' })
        : err({ type: 'InvalidCredentials' });
    case 403:
      return err({ type: 'AccountSuspended' });
    case 426:
      return err({ type: 'UpdateRequired' });
    case 429:
      return err({
        type: 'TooManyAttempts',
        minutesToWait: minutesToWait(answer.headers.get('Retry-After')),
      });
    default:
      return null;
  }
};

/**
 * The refusals the account's own changes share: a wrong current password is a 401 that names
 * itself, unlike the 401 of a device the server no longer knows.
 */
const ownAccountFailure = (answer: Answer & { kind: 'response' }) => {
  const code = errorCode(answer.body);
  if (answer.status === 401 && code === 'InvalidCredentials') {
    return { type: 'InvalidCredentials' } as const;
  }
  if (answer.status === 429) {
    return {
      type: 'TooManyAttempts',
      minutesToWait: minutesToWait(answer.headers.get('Retry-After')),
    } as const;
  }
  return syncFailure(answer);
};

const toPairing = (
  body: AccountPairing & { account: AccountInfo },
): { pairing: AccountPairing; account: AccountInfo } => ({
  pairing: {
    deviceId: body.deviceId,
    credential: body.credential,
    serverId: body.serverId,
    apiVersion: body.apiVersion,
    minAppVersion: body.minAppVersion,
    accountId: body.accountId,
  },
  account: {
    id: body.account.id,
    email: body.account.email,
    role: body.account.role,
  },
});

/** The `AccountServer` over `fetch`. */
export const createAccountServer = (
  options: TransportOptions,
): AccountServer => {
  const send = createSend(options);
  return {
    async signIn(url, email, password, deviceName) {
      const answer = await send(url, '/v1/auth/sign-in', {
        method: 'POST',
        body: { email, password, deviceName },
      });
      const failure = authFailure(answer);
      if (failure !== null) return failure;
      if (answer.kind !== 'response') return err({ type: 'ServerUnreachable' });
      const body = answer.body as { outcome?: unknown } | null;
      if (answer.status === 200 && body?.outcome === 'passwordChangeRequired') {
        return ok({ type: 'passwordChangeRequired' });
      }
      if (
        answer.status === 200 &&
        body?.outcome === 'signedIn' &&
        isAccountPairing(body)
      ) {
        return ok({ type: 'signedIn', ...toPairing(body) });
      }
      return err({ type: 'ServerUnreachable' });
    },

    async choosePassword(
      url,
      email,
      temporaryPassword,
      newPassword,
      deviceName,
    ) {
      const answer = await send(url, '/v1/auth/choose-password', {
        method: 'POST',
        body: { email, temporaryPassword, newPassword, deviceName },
      });
      const failure = authFailure(answer);
      if (failure !== null) return failure;
      if (answer.kind !== 'response') return err({ type: 'ServerUnreachable' });
      const body = answer.body;
      if (answer.status === 200 && isAccountPairing(body)) {
        return ok(toPairing(body).pairing);
      }
      const problem = (body as { problem?: unknown } | null)?.problem;
      if (
        answer.status === 400 &&
        errorCode(body) === 'InvalidPassword' &&
        typeof problem === 'string' &&
        PASSWORD_PROBLEMS.includes(problem)
      ) {
        return err({
          type: 'PasswordRejected',
          problem: problem as PasswordProblem,
        });
      }
      return err({ type: 'ServerUnreachable' });
    },

    async requestPasswordReset(url, email) {
      const answer = await send(url, '/v1/auth/password-reset', {
        method: 'POST',
        body: { email },
      });
      if (answer.kind === 'untrusted') return err({ type: 'UntrustedServer' });
      if (answer.kind === 'unreachable') {
        return err({ type: 'ServerUnreachable' });
      }
      switch (answer.status) {
        case 202:
          return ok(undefined);
        case 400:
          return errorCode(answer.body) === 'InvalidEmail'
            ? err({ type: 'InvalidEmail' })
            : err({ type: 'ServerUnreachable' });
        case 426:
          return err({ type: 'UpdateRequired' });
        case 429:
          return err({
            type: 'TooManyAttempts',
            minutesToWait: minutesToWait(answer.headers.get('Retry-After')),
          });
        default:
          return err({ type: 'ServerUnreachable' });
      }
    },

    async changePassword(conn, currentPassword, newPassword) {
      const answer = await send(conn.url, '/v1/account/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        credential: conn.credential,
      });
      if (answer.kind !== 'response') return transportFailure(answer);
      if (answer.status === 204) return ok(undefined);
      const problem = (answer.body as { problem?: unknown } | null)?.problem;
      if (
        answer.status === 400 &&
        errorCode(answer.body) === 'InvalidPassword' &&
        typeof problem === 'string' &&
        PASSWORD_PROBLEMS.includes(problem)
      ) {
        return err({
          type: 'PasswordRejected',
          problem: problem as PasswordProblem,
        });
      }
      return err(ownAccountFailure(answer));
    },

    async deleteAccount(conn, password) {
      const answer = await send(conn.url, '/v1/account', {
        method: 'DELETE',
        body: { password },
        credential: conn.credential,
      });
      if (answer.kind !== 'response') return transportFailure(answer);
      if (answer.status === 204) return ok(undefined);
      if (errorCode(answer.body) === 'LastAdministrator') {
        return err({ type: 'LastAdministrator' });
      }
      return err(ownAccountFailure(answer));
    },

    async getAccount(conn) {
      const answer = await send(conn.url, '/v1/account', {
        method: 'GET',
        credential: conn.credential,
      });
      if (answer.kind !== 'response') return transportFailure(answer);
      const account = (answer.body as { account?: unknown } | null)?.account;
      if (answer.status === 200 && isAccountInfo(account)) {
        return ok({ id: account.id, email: account.email, role: account.role });
      }
      return answer.status === 200
        ? err({ type: 'ServerError' })
        : err(syncFailure(answer));
    },
  };
};
