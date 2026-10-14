import {
  MailFailedError,
  type Mailer,
  type MailMessage,
} from '../../application/ports/mailer';
import { renderMail } from './templates';

/**
 * For development only: prints each message, temporary password included. Selected only when no
 * SMTP server is configured and `NODE_ENV` is not `production` (research R8).
 */
export const createConsoleMailer = (
  print: (text: string) => void = console.log,
): Mailer => ({
  async send(message: MailMessage) {
    const mail = renderMail(message);
    print(`--- mail to ${mail.to}: ${mail.subject}\n${mail.text}---`);
  },
});

/** In production an empty SMTP setting must not fall back to printing secrets: every send fails. */
export const createUnconfiguredMailer = (): Mailer => ({
  async send() {
    throw new MailFailedError();
  },
});
