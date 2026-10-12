import { err } from '../../domain/result';
import type { AccountServer } from '../ports/account-server';

/** An account server nobody can reach, for tests and stories that do not use the account. */
export class OfflineAccountServer implements AccountServer {
  getAccount: AccountServer['getAccount'] = async () =>
    err({ type: 'Offline' });
}
