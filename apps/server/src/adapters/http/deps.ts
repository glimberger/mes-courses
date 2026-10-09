import type { Clock } from '../../application/ports/clock';
import type { ErrorReporter } from '../../application/ports/error-reporter';
import type { IdGenerator } from '../../application/ports/id-generator';
import type { PairingCrypto } from '../../application/ports/pairing-crypto';
import type { DeviceRecord, ServerStore } from '../../application/ports/store';

export type AppDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: PairingCrypto;
  ids: IdGenerator;
  errorReporter: ErrorReporter;
  /** Apps below this version are refused with 426. */
  minAppVersion: string;
};

declare module 'fastify' {
  interface FastifyContextConfig {
    /** The route needs no device credential. */
    public?: boolean;
  }
  interface FastifyRequest {
    /** The authorized device, set by the auth hook on non-public routes. */
    device?: DeviceRecord;
  }
}
