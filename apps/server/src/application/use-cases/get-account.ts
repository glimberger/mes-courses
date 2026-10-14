import type { AccountInfo } from '@mes-courses/sync-core';

import type { AccountRecord } from '../../domain/account';

/**
 * What the caller may know about their own account. The role comes from the stored account on
 * every call; the app never trusts a cached one (research R9, R12).
 */
export const getAccount = (account: AccountRecord): AccountInfo => ({
  id: account.id,
  // An authenticated device belongs to an account that has an address; only the setup account has none.
  email: account.email ?? '',
  role: account.role,
});
