import type { AppDeps } from '../adapters/http/app';
import { systemClock } from '../adapters/clock/system-clock';
import {
  createPairingCrypto,
  systemIdGenerator,
  systemRandom,
} from '../adapters/crypto/crypto';
import { createPasswordHasher } from '../adapters/crypto/password-hasher';
import {
  createConsoleMailer,
  createUnconfiguredMailer,
} from '../adapters/mail/console-mailer';
import { createSmtpMailer } from '../adapters/mail/smtp-mailer';
import type { Clock } from '../application/ports/clock';
import type { ErrorReporter } from '../application/ports/error-reporter';
import type { Mailer } from '../application/ports/mailer';
import type { PasswordHasher } from '../application/ports/password-hasher';
import type { ServerStore } from '../application/ports/store';
import { ATTEMPT_RETENTION_MS } from '../domain/attempts';
import { MIN_APP_VERSION, type MailConfig } from './config';

/** The mailer the environment asks for (research R8). */
export const createMailer = (config: MailConfig): Mailer => {
  switch (config.mode) {
    case 'smtp':
      return createSmtpMailer({ url: config.url, from: config.from });
    case 'console':
      return createConsoleMailer();
    case 'unconfigured':
      return createUnconfiguredMailer();
  }
};

/** The release of a server started with no build info (tests, development). */
const DEV_RELEASE = { version: '0.0.0-dev', commit: 'dev' };

export const appDeps = ({
  store,
  errorReporter,
  mailer,
  publicUrl,
  release = DEV_RELEASE,
  clock = systemClock,
  hasher = createPasswordHasher(systemRandom),
}: {
  store: ServerStore;
  errorReporter: ErrorReporter;
  mailer: Mailer;
  publicUrl: string;
  release?: AppDeps['release'];
  clock?: Clock;
  hasher?: PasswordHasher;
}): AppDeps => ({
  store,
  clock,
  crypto: createPairingCrypto(systemRandom),
  ids: systemIdGenerator,
  errorReporter,
  hasher,
  mailer,
  publicUrl,
  minAppVersion: MIN_APP_VERSION,
  release,
});

/** Forgets the sign-in and reset attempts no limit reads any more (also done on every auth request). */
export const pruneAuthAttempts = (
  store: ServerStore,
  clock: Clock = systemClock,
): Promise<void> =>
  store.run(({ authAttempts }) =>
    authAttempts.pruneBefore(
      new Date(clock.nowMs() - ATTEMPT_RETENTION_MS).toISOString(),
    ),
  );
