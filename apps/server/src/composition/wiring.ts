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

export const appDeps = ({
  store,
  errorReporter,
  mailer,
  publicUrl,
  clock = systemClock,
  hasher = createPasswordHasher(systemRandom),
}: {
  store: ServerStore;
  errorReporter: ErrorReporter;
  mailer: Mailer;
  publicUrl: string;
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
});
