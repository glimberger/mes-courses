import type { AccountInfo } from '@mes-courses/sync-core';

import { err, ok } from '../../domain/result';
import type { AccountServer } from '../ports/account-server';

/** The caller's own account in memory, for use case tests, screen tests and stories. */
export class InMemoryAccountServer implements AccountServer {
  /** Every call fails as if the phone had no network. */
  offline = false;
  account: AccountInfo;

  constructor(
    account: AccountInfo = {
      id: 'account-1',
      email: 'marie@example.org',
      role: 'user',
    },
  ) {
    this.account = account;
  }

  getAccount: AccountServer['getAccount'] = async () =>
    this.offline ? err({ type: 'Offline' }) : ok({ ...this.account });
}
