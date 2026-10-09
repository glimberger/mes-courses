import type { AppDeps } from '../adapters/http/app';
import { systemClock } from '../adapters/clock/system-clock';
import {
  createPairingCrypto,
  systemIdGenerator,
  systemRandom,
} from '../adapters/crypto/crypto';
import type { Clock } from '../application/ports/clock';
import type { ErrorReporter } from '../application/ports/error-reporter';
import type { ServerStore } from '../application/ports/store';
import { MIN_APP_VERSION } from './config';

export const appDeps = ({
  store,
  errorReporter,
  clock = systemClock,
}: {
  store: ServerStore;
  errorReporter: ErrorReporter;
  clock?: Clock;
}): AppDeps => ({
  store,
  clock,
  crypto: createPairingCrypto(systemRandom),
  ids: systemIdGenerator,
  errorReporter,
  minAppVersion: MIN_APP_VERSION,
});
