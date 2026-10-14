import type { AccountSummary } from '@mes-courses/sync-core';

import type { ChangePasswordError } from '../../../application/use-cases/change-password';
import type { ReactivateAccountError } from '../../../application/use-cases/reactivate-account';
import type { ResendCredentialsError } from '../../../application/use-cases/resend-credentials';
import type { SuspendAccountError } from '../../../application/use-cases/suspend-account';
import type { DeleteAccountAsAdminError } from '../../../application/use-cases/delete-account-as-admin';
import type { Forbidden } from '../../../application/ports/admin-server';
import type { SyncFailure } from '../../../application/ports/sync-server';
import type { AccountSettings } from '../../../application/use-cases/get-account-settings';
import type { InviteAccountError } from '../../../application/use-cases/invite-account';
import type { RequestPasswordResetError } from '../../../application/use-cases/request-password-reset';
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
  /** Asks for a new temporary password by email (US4-1). */
  requestPasswordReset: (
    url: string,
    email: string,
  ) => Promise<Result<void, RequestPasswordResetError | SyncFailure>>;
  /** Invites an address (US1-1 to US1-4). */
  inviteAccount: (
    email: string,
  ) => Promise<Result<AccountSummary, InviteAccountError>>;
  /** Stops an account from syncing; its data is kept (US5-2, US5-5). */
  suspendAccount: (id: string) => Promise<Result<void, SuspendAccountError>>;
  /** Lifts a suspension and says so (US5-3). */
  reactivateAccount: (
    id: string,
  ) => Promise<Result<void, ReactivateAccountError>>;
  /** Sends a new temporary password to an invited account (US5-6). */
  resendCredentials: (
    id: string,
  ) => Promise<Result<void, ResendCredentialsError>>;
  /** Changes the password of the signed-in account; the other devices stay signed in (US6-2). */
  changePassword: (
    current: string,
    next: string,
    confirmation: string,
  ) => Promise<Result<void, ChangePasswordError>>;
  /** Deletes an account and its data from the server (US5-4, US5-5). */
  deleteAccountAsAdmin: (
    id: string,
  ) => Promise<Result<void, DeleteAccountAsAdminError>>;
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

    requestPasswordReset: (url, email) =>
      call('requestPasswordReset', 'ForgotPassword', () =>
        useCases.requestPasswordReset(url, email),
      ),

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

    suspendAccount: (id) =>
      call('suspendAccount', 'Accounts', () => useCases.suspendAccount(id)),

    reactivateAccount: async (id) => {
      const outcome = await call('reactivateAccount', 'Accounts', () =>
        useCases.reactivateAccount(id),
      );
      if (outcome.ok) kit.set({ notice: { type: 'accountReactivated' } });
      return outcome;
    },

    resendCredentials: async (id) => {
      const outcome = await call('resendCredentials', 'Accounts', () =>
        useCases.resendCredentials(id),
      );
      if (outcome.ok) kit.set({ notice: { type: 'credentialsResent' } });
      return outcome;
    },

    changePassword: async (current, next, confirmation) => {
      const outcome = await call('changePassword', 'Settings', () =>
        useCases.changePassword(current, next, confirmation),
      );
      if (outcome.ok) kit.set({ notice: { type: 'passwordChanged' } });
      return outcome;
    },

    deleteAccountAsAdmin: (id) =>
      call('deleteAccountAsAdmin', 'Accounts', () =>
        useCases.deleteAccountAsAdmin(id),
      ),
  };
};
