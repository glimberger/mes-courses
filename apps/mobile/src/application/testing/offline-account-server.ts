import { err } from '../../domain/result';
import type { AccountServer } from '../ports/account-server';

/** An account server nobody can reach, for tests and stories that do not use the account. */
export class OfflineAccountServer implements AccountServer {
  signIn: AccountServer['signIn'] = async () =>
    err({ type: 'ServerUnreachable' });
  choosePassword: AccountServer['choosePassword'] = async () =>
    err({ type: 'ServerUnreachable' });
  requestPasswordReset: AccountServer['requestPasswordReset'] = async () =>
    err({ type: 'ServerUnreachable' });
  getAccount: AccountServer['getAccount'] = async () =>
    err({ type: 'Offline' });
  changePassword: AccountServer['changePassword'] = async () =>
    err({ type: 'Offline' });
  deleteAccount: AccountServer['deleteAccount'] = async () =>
    err({ type: 'Offline' });
}
