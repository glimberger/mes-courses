import type { AccountSummary } from '@mes-courses/sync-core';

import type { Forbidden } from '../../../application/ports/admin-server';
import type { SyncFailure } from '../../../application/ports/sync-server';
import type { AccountSettings } from '../../../application/use-cases/get-account-settings';
import type { InviteAccountError } from '../../../application/use-cases/invite-account';
import { err, type Result } from '../../../domain/result';
import { reactToFailure } from './failure-reactions';
import type { StoreKit } from './store-kit';

/** The actions of the account screens: Settings' account section and the administrator's list. */
export type AccountsActions = {
  /** The address, the role and the devices, read from the server on every call (US6-1). */
  getAccountSettings: () => Promise<AccountSettings>;
  /** The accounts of the server, for an administrator (US5-1). */
  listAccounts: () => Promise<
    Result<AccountSummary[], SyncFailure | Forbidden>
  >;
  /** Invites an address (US1-1 to US1-4). */
  inviteAccount: (
    email: string,
  ) => Promise<Result<AccountSummary, InviteAccountError>>;
};

export const createAccountsActions = (kit: StoreKit): AccountsActions => {
  const { useCases, report } = kit;

  /** A throw is reported and answered as a server error: the request may have failed any way. */
  const call = async <T, E extends { type: string }>(
    operation: string,
    screen: string,
    run: () => Promise<Result<T, E | SyncFailure>>,
  ): Promise<Result<T, E | SyncFailure>> => {
    let outcome: Result<T, E | SyncFailure>;
    try {
      outcome = await run();
    } catch (error) {
      report(error, operation, screen);
      return err({ type: 'ServerError' });
    }
    if (!outcome.ok) reactToFailure(kit, operation, screen, outcome.error);
    return outcome;
  };

  return {
    getAccountSettings: async () => {
      let settings: AccountSettings;
      try {
        settings = await useCases.getAccountSettings();
      } catch (error) {
        report(error, 'getAccountSettings', 'Settings');
        const failure = err<SyncFailure>({ type: 'ServerError' });
        return {
          sync: {
            serverUrl: null,
            lastSyncAt: null,
            pendingCount: 0,
            connection: 'notConnected',
          },
          account: failure,
          devices: failure,
        };
      }
      // A refusal of the account or of the devices changes the connection once.
      for (const outcome of [settings.account, settings.devices]) {
        if (outcome !== null && !outcome.ok) {
          reactToFailure(kit, 'getAccountSettings', 'Settings', outcome.error);
          break;
        }
      }
      return settings;
    },

    listAccounts: () =>
      call('listAccounts', 'Accounts', () => useCases.listAccounts()),

    inviteAccount: async (email) => {
      const outcome = await call('inviteAccount', 'Accounts', () =>
        useCases.inviteAccount(email),
      );
      if (outcome.ok) {
        kit.set({
          notice: { type: 'invitationSent', email: outcome.value.email },
        });
      }
      return outcome;
    },
  };
};
