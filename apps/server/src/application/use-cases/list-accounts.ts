import type { AccountSummary } from '@mes-courses/sync-core';

import type { Clock } from '../ports/clock';
import type { ServerStore } from '../ports/store';
import { summaryOf } from './invite-account';

export type ListAccountsDeps = { store: ServerStore; clock: Clock };

/**
 * Every account with a state and a last sync, by creation time, then id. The setup account has no
 * address until `create-admin` completed it, and is not listed before (research R2). No list,
 * article, category or device of an account is returned (research R12).
 */
export const listAccounts = async ({
  store,
  clock,
}: ListAccountsDeps): Promise<AccountSummary[]> =>
  store.run(async ({ accounts }) => {
    const nowMs = clock.nowMs();
    const summaries: AccountSummary[] = [];
    for (const record of await accounts.all()) {
      if (record.email === null) continue;
      summaries.push(
        summaryOf(record, await accounts.lastSyncAt(record.id), nowMs),
      );
    }
    return summaries;
  });
