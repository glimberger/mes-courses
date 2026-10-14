import { err } from '../../domain/result';
import type { AdminServer } from '../ports/admin-server';

/** An admin server nobody can reach, for tests and stories that do not manage accounts. */
export class OfflineAdminServer implements AdminServer {
  listAccounts: AdminServer['listAccounts'] = async () =>
    err({ type: 'Offline' });
  invite: AdminServer['invite'] = async () => err({ type: 'Offline' });
  suspend: AdminServer['suspend'] = async () => err({ type: 'Offline' });
  reactivate: AdminServer['reactivate'] = async () => err({ type: 'Offline' });
  resendCredentials: AdminServer['resendCredentials'] = async () =>
    err({ type: 'Offline' });
  delete: AdminServer['delete'] = async () => err({ type: 'Offline' });
}
