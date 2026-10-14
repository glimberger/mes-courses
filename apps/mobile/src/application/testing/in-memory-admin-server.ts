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

  /** The next resends fail as if the email could not be sent. */
  resendMailFails = false;
  /** The state an account returns to when reactivated. */
  private readonly stateBeforeSuspension = new Map<
    string,
    'invited' | 'active'
  >();
  readonly suspended: string[] = [];
  readonly reactivated: string[] = [];
  readonly resent: string[] = [];
  readonly deleted: string[] = [];

  private find(id: string): AccountSummary | undefined {
    return this.accounts.find((account) => account.id === id);
  }

  /** Another administrator that is not suspended: the rule of the server (FR-013, FR-016). */
  private lastAdministrator(account: AccountSummary): boolean {
    return (
      account.role === 'administrator' &&
      !this.accounts.some(
        (other) =>
          other.id !== account.id &&
          other.role === 'administrator' &&
          other.state === 'active',
      )
    );
  }

  private replace(id: string, change: Partial<AccountSummary>) {
    this.accounts = this.accounts.map((account) =>
      account.id === id ? { ...account, ...change } : account,
    );
  }

  suspend: AdminServer['suspend'] = async (_conn, id) => {
    if (this.offline) return err({ type: 'Offline' });
    if (this.forbidden) return err({ type: 'Forbidden' });
    const account = this.find(id);
    if (account === undefined) return err({ type: 'NotFound' });
    if (account.state !== 'suspended') {
      if (this.lastAdministrator(account)) {
        return err({ type: 'LastAdministrator' });
      }
      this.stateBeforeSuspension.set(
        id,
        account.state === 'invited' ? 'invited' : 'active',
      );
      this.replace(id, { state: 'suspended' });
    }
    this.suspended.push(id);
    return ok(undefined);
  };

  reactivate: AdminServer['reactivate'] = async (_conn, id) => {
    if (this.offline) return err({ type: 'Offline' });
    if (this.forbidden) return err({ type: 'Forbidden' });
    const account = this.find(id);
    if (account === undefined) return err({ type: 'NotFound' });
    if (account.state === 'suspended') {
      this.replace(id, {
        state: this.stateBeforeSuspension.get(id) ?? 'active',
      });
    }
    this.reactivated.push(id);
    return ok(undefined);
  };

  resendCredentials: AdminServer['resendCredentials'] = async (_conn, id) => {
    if (this.offline) return err({ type: 'Offline' });
    if (this.forbidden) return err({ type: 'Forbidden' });
    const account = this.find(id);
    if (account === undefined) return err({ type: 'NotFound' });
    if (account.state !== 'invited') return err({ type: 'NotInvited' });
    if (this.resendMailFails) return err({ type: 'MailFailed' });
    this.replace(id, { invitationExpired: false });
    this.resent.push(id);
    return ok(undefined);
  };

  delete: AdminServer['delete'] = async (_conn, id) => {
    if (this.offline) return err({ type: 'Offline' });
    if (this.forbidden) return err({ type: 'Forbidden' });
    const account = this.find(id);
    if (account === undefined) return err({ type: 'NotFound' });
    if (this.lastAdministrator(account)) {
      return err({ type: 'LastAdministrator' });
    }
    this.accounts = this.accounts.filter((other) => other.id !== id);
    this.deleted.push(id);
    return ok(undefined);
  };
}
