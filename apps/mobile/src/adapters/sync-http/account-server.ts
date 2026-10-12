import type { AccountInfo } from '@mes-courses/sync-core';

import type { AccountServer } from '../../application/ports/account-server';
import { err, ok } from '../../domain/result';
import {
  createSend,
  syncFailure,
  transportFailure,
  type TransportOptions,
} from './transport';

const isAccountInfo = (value: unknown): value is AccountInfo =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AccountInfo).id === 'string' &&
  typeof (value as AccountInfo).email === 'string' &&
  ((value as AccountInfo).role === 'user' ||
    (value as AccountInfo).role === 'administrator');

/** The `AccountServer` over `fetch`. */
export const createAccountServer = (
  options: TransportOptions,
): AccountServer => {
  const send = createSend(options);
  return {
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
