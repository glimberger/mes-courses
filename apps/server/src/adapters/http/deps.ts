import type { Clock } from '../../application/ports/clock';
import type { ErrorReporter } from '../../application/ports/error-reporter';
import type { IdGenerator } from '../../application/ports/id-generator';
import type { Mailer } from '../../application/ports/mailer';
import type { PasswordHasher } from '../../application/ports/password-hasher';
import type { PairingCrypto } from '../../application/ports/pairing-crypto';
import type { AccountRecord } from '../../domain/account';
import type { DeviceRecord, ServerStore } from '../../application/ports/store';

export type AppDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: PairingCrypto;
  ids: IdGenerator;
  errorReporter: ErrorReporter;
  hasher: PasswordHasher;
  mailer: Mailer;
  /** The server's public address, written in the invitation (`MES_COURSES_PUBLIC_URL`). */
  publicUrl: string;
  /** Apps below this version are refused with 426. */
  minAppVersion: string;
  /** The release this server is, reported by `GET /v1/health` (FR-029). */
  release: { version: string; commit: string };
};

declare module 'fastify' {
  interface FastifyContextConfig {
    /** The route needs no device credential. */
    public?: boolean;
    /** Only an administrator may call the route (`403 Forbidden` otherwise). */
    administrator?: boolean;
  }
  interface FastifyRequest {
    /** The authorized device, set by the auth hook on non-public routes. */
    device?: DeviceRecord;
    /** The account the device belongs to, set with `device`. */
    account?: AccountRecord;
  }
}
