import type { AccountSummary } from '@mes-courses/sync-core';

import type { AdminServer } from '../../application/ports/admin-server';
import type { Connection } from '../../application/ports/sync-server';
import type { Result } from '../../domain/result';
import { err, ok } from '../../domain/result';
import {
  createSend,
  errorCode,
  syncFailure,
  transportFailure,
  type TransportOptions,
} from './transport';

const accountPath = (id: string, action = '') =>
  `/v1/admin/accounts/${encodeURIComponent(id)}${action}`;

/** The `AdminServer` over `fetch`. */
export const createAdminServer = (options: TransportOptions): AdminServer => {
  const send = createSend(options);

  /** An administration action: `204`, or the refusal of the server as a typed error. */
  const act = async <R extends Result<void, { type: string }>>(
    conn: Connection,
    method: 'POST' | 'DELETE',
    path: string,
    refusals: ('LastAdministrator' | 'NotInvited' | 'MailFailed')[],
  ): Promise<R> => {
    const answer = await send(conn.url, path, {
      method,
      credential: conn.credential,
    });
    // The caller's return type says which refusals are possible.
    if (answer.kind !== 'response') return transportFailure(answer) as R;
    if (answer.status === 204) return ok(undefined) as R;
    const code = errorCode(answer.body);
    if (code === 'Forbidden') return err({ type: 'Forbidden' }) as R;
    if (code === 'NotFound') return err({ type: 'NotFound' }) as R;
    for (const refusal of refusals) {
      if (code === refusal) return err({ type: refusal }) as R;
    }
    return err(syncFailure(answer)) as R;
  };

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

    suspend: (conn, id) =>
      act(conn, 'POST', accountPath(id, '/suspend'), ['LastAdministrator']),
    reactivate: (conn, id) =>
      act(conn, 'POST', accountPath(id, '/reactivate'), []),
    resendCredentials: (conn, id) =>
      act(conn, 'POST', accountPath(id, '/resend-credentials'), [
        'NotInvited',
        'MailFailed',
      ]),
    delete: (conn, id) =>
      act(conn, 'DELETE', accountPath(id), ['LastAdministrator']),
  };
};
