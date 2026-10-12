import type { DataRepositoriesRun, ServerStore } from '../../ports/store';
import { account } from './entities';

/** The account the 003 contract suites run in (mechanical change of feature 004). */
export const DEFAULT_ACCOUNT_ID = 'acc-default';

/** A store whose `run` is bound to one account, so 003's suites keep their shape. */
export type ScopedStore = {
  run: DataRepositoriesRun;
};

export const scopedTo = async (
  store: ServerStore,
  accountId = DEFAULT_ACCOUNT_ID,
): Promise<ScopedStore> => {
  await store.run(({ accounts }) =>
    accounts.add(account(accountId, `${accountId}@example.org`)),
  );
  return { run: (work) => store.runForAccount(accountId, work) };
};
