import type { AccountSummary } from '@mes-courses/sync-core';

import type { AdminServer } from '../../application/ports/admin-server';
import { err, ok } from '../../domain/result';
import {
  createSend,
  errorCode,
  syncFailure,
  transportFailure,
  type TransportOptions,
} from './transport';

/** The `AdminServer` over `fetch`. */
export const createAdminServer = (options: TransportOptions): AdminServer => {
  const send = createSend(options);
  return {
    async listAccounts(conn) {
      const answer = await send(conn.url, '/v1/admin/accounts', {
        method: 'GET',
        credential: conn.credential,
      });
      if (answer.kind !== 'response') return transportFailure(answer);
      const accounts = (answer.body as { accounts?: unknown } | null)?.accounts;
      if (answer.status === 200 && Array.isArray(accounts)) {
        return ok(accounts as AccountSummary[]);
      }
      if (errorCode(answer.body) === 'Forbidden') {
        return err({ type: 'Forbidden' });
      }
      return err(syncFailure(answer));
    },

    async invite(conn, email) {
      const answer = await send(conn.url, '/v1/admin/accounts', {
        method: 'POST',
        body: { email },
        credential: conn.credential,
      });
      if (answer.kind !== 'response') return transportFailure(answer);
      const account = (answer.body as { account?: unknown } | null)?.account;
      if (answer.status === 201 && typeof account === 'object' && account) {
        return ok(account as AccountSummary);
      }
      switch (errorCode(answer.body)) {
        case 'InvalidEmail':
          return err({ type: 'InvalidEmail' });
        case 'AccountExists':
          return err({ type: 'AccountExists' });
        case 'MailFailed':
          return err({ type: 'MailFailed' });
        case 'Forbidden':
          return err({ type: 'Forbidden' });
        default:
          return err(syncFailure(answer));
      }
    },
  };
};
