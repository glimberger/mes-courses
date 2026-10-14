import {
  authenticateDevice,
  type AuthResult,
} from '../../application/use-cases/authenticate-device';
import type { AppDeps } from './deps';

/** The Bearer credential of an `Authorization` header, or `null`. */
export const bearerCredential = (header: string | undefined): string | null => {
  const match = /^Bearer (\S+)$/.exec(header ?? '');
  return match?.[1] ?? null;
};

/** The device and account for an `Authorization: Bearer <credential>` header, or why not. */
export const authenticate = (
  deps: Pick<AppDeps, 'store' | 'crypto'>,
  header: string | undefined,
): Promise<AuthResult> => authenticateDevice(deps, bearerCredential(header));
