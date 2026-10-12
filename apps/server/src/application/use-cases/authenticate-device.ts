import type { AccountRecord } from '../../domain/account';
import type { PairingCrypto } from '../ports/pairing-crypto';
import type { DeviceRecord, ServerStore } from '../ports/store';

export type AuthenticateDeviceDeps = {
  store: ServerStore;
  crypto: Pick<PairingCrypto, 'sha256Hex'>;
};

export type AuthResult =
  | { kind: 'authorized'; device: DeviceRecord; account: AccountRecord }
  /** No credential, an unknown one, or a revoked device: `401 DeviceNotAuthorized`. */
  | { kind: 'notAuthorized' }
  /** The credential belonged to a deleted account: `401 AccountDeleted`. */
  | { kind: 'accountDeleted' }
  /** `403 AccountSuspended`. */
  | { kind: 'suspended' };

/**
 * Resolves a Bearer credential to its device and account. The order is fixed (contracts/auth-api.md)
 * and nothing is read before it passes: unknown, ended, revoked, suspended.
 */
export const authenticateDevice = async (
  { store, crypto }: AuthenticateDeviceDeps,
  credential: string | null,
): Promise<AuthResult> => {
  if (credential === null) return { kind: 'notAuthorized' };
  const credentialHash = crypto.sha256Hex(credential);
  return store.run(
    async ({ devices, endedCredentials, accounts }): Promise<AuthResult> => {
      const device = await devices.findByCredentialHash(credentialHash);
      if (device === null) {
        return (await endedCredentials.find(credentialHash)) !== null
          ? { kind: 'accountDeleted' }
          : { kind: 'notAuthorized' };
      }
      if (device.revokedAt !== null) return { kind: 'notAuthorized' };
      const account = await accounts.get(device.accountId);
      if (account === null) return { kind: 'notAuthorized' };
      if (account.suspendedAt !== null) return { kind: 'suspended' };
      return { kind: 'authorized', device, account };
    },
  );
};
