import { err } from '../../domain/result';
import type { AdminServer } from '../ports/admin-server';

/** An admin server nobody can reach, for tests and stories that do not manage accounts. */
export class OfflineAdminServer implements AdminServer {
  listAccounts: AdminServer['listAccounts'] = async () =>
    err({ type: 'Offline' });
  invite: AdminServer['invite'] = async () => err({ type: 'Offline' });
}
