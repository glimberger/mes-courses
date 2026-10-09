import type { DeviceRecord } from '../../application/ports/store';
import type { AppDeps } from './deps';

/** The authorized device for an `Authorization: Bearer <credential>` header, or `null`. */
export const authenticate = async (
  { store, crypto }: Pick<AppDeps, 'store' | 'crypto'>,
  header: string | undefined,
): Promise<DeviceRecord | null> => {
  const match = /^Bearer (\S+)$/.exec(header ?? '');
  const credential = match?.[1];
  if (credential === undefined) return null;
  const credentialHash = crypto.sha256Hex(credential);
  const device = await store.run(({ devices }) =>
    devices.findByCredentialHash(credentialHash),
  );
  return device !== null && device.revokedAt === null ? device : null;
};
