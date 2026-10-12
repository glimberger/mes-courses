import type { AccountSummary } from '@mes-courses/sync-core';
import { normalizeEmail } from '@mes-courses/sync-core';

import { err, ok } from '../../domain/result';
import type { AdminServer } from '../ports/admin-server';

/**
 * An administrator's server in memory, for use case tests, screen tests and stories: it keeps
 * the accounts it lists, refuses what the real one refuses, and can be made unreachable.
 */
export class InMemoryAdminServer implements AdminServer {
  accounts: AccountSummary[];
  /** Every call fails as if the phone had no network. */
  offline = false;
  /** The next invitations fail as if the email could not be sent. */
  mailFails = false;
  /** The caller is an ordinary user. */
  forbidden = false;
  readonly invited: string[] = [];

  constructor(accounts: AccountSummary[] = []) {
    this.accounts = accounts;
  }

  listAccounts: AdminServer['listAccounts'] = async () => {
    if (this.offline) return err({ type: 'Offline' });
    if (this.forbidden) return err({ type: 'Forbidden' });
    return ok([...this.accounts]);
  };

  invite: AdminServer['invite'] = async (_conn, email) => {
    if (this.offline) return err({ type: 'Offline' });
    if (this.forbidden) return err({ type: 'Forbidden' });
    const normalized = normalizeEmail(email);
    if (normalized === null) return err({ type: 'InvalidEmail' });
    if (this.accounts.some((account) => account.email === normalized)) {
      return err({ type: 'AccountExists' });
    }
    if (this.mailFails) return err({ type: 'MailFailed' });
    const account: AccountSummary = {
      id: `account-${this.accounts.length + 1}`,
      email: normalized,
      role: 'user',
      state: 'invited',
      lastSyncAt: null,
      invitationExpired: false,
    };
    this.accounts.push(account);
    this.invited.push(normalized);
    return ok(account);
  };
}
