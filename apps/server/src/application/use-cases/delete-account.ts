import { attemptKey } from '../../domain/attempts';
import { canLoseAdministrator } from '../../domain/account';
import type { Clock } from '../ports/clock';
import type { PairingCrypto } from '../ports/pairing-crypto';
import type { ServerStore } from '../ports/store';

export type DeleteAccountDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: Pick<PairingCrypto, 'sha256Hex'>;
};

export type DeleteOutcome =
  { kind: 'deleted' } | { kind: 'notFound' } | { kind: 'lastAdministrator' };

/**
 * Removes an account and everything it owns, in one transaction (FR-016, SC-007): each device
 * credential is kept in `ended_credential` so the phone learns why it is refused (research R7),
 * the attempt rows keyed by the address go, then the account and, by cascade, the rest.
 * The account owner's own deletion reuses it after checking the password.
 */
export const deleteAccount = async (
  { store, clock, crypto }: DeleteAccountDeps,
  id: string,
): Promise<DeleteOutcome> =>
  store.run(
    async ({
      accounts,
      devices,
      endedCredentials,
      authAttempts,
    }): Promise<DeleteOutcome> => {
      const account = await accounts.get(id);
      if (account === null) return { kind: 'notFound' };
      if (
        !canLoseAdministrator(
          account,
          await accounts.countOtherActiveAdministrators(id),
        )
      ) {
        return { kind: 'lastAdministrator' };
      }
      const at = new Date(clock.nowMs()).toISOString();
      for (const device of await devices.forAccount(id)) {
        await endedCredentials.add(device.credentialHash, 'accountDeleted', at);
      }
      if (account.email !== null) {
        await authAttempts.deleteForKey(
          attemptKey(crypto.sha256Hex, account.email),
        );
      }
      await accounts.delete(id);
      return { kind: 'deleted' };
    },
  );
