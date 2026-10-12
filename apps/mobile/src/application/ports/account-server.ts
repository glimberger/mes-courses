import type { AccountInfo } from '@mes-courses/sync-core';

import type { Result } from '../../domain/result';
import type { Connection, SyncFailure } from './sync-server';

/**
 * The HTTP adapter for the caller's own account, over the same transport as `SyncServer`. Grows
 * story by story: sign-in and the password come with US2, US4 and US6.
 */
export interface AccountServer {
  getAccount(conn: Connection): Promise<Result<AccountInfo, SyncFailure>>;
}
