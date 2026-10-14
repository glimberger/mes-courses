import { createTransport, type Transporter } from 'nodemailer';

import {
  MailFailedError,
  type Mailer,
  type MailMessage,
} from '../../application/ports/mailer';
import { renderMail } from './templates';

export type SmtpMailerOptions = {
  /** `smtp://user:pass@host:587`; read from `MES_COURSES_SMTP_URL`, never printed. */
  url: string;
  from: string;
  /** Test only: trust the throwaway certificate of the in-process SMTP server. */
  trustAnyCertificate?: boolean;
};

/**
 * Sends through an SMTP provider with STARTTLS required: a server that does not offer it is
 * refused rather than used in clear (research R8). Every failure becomes a `MailFailedError`
 * whose message is fixed, since nodemailer's own messages can contain the recipient.
 */
export const createSmtpMailer = ({
  url,
  from,
  trustAnyCertificate = false,
}: SmtpMailerOptions): Mailer => {
  let transport: Transporter | null = null;
  const transporter = (): Transporter =>
    (transport ??= createTransport({
      url,
      requireTLS: true,
      ...(trustAnyCertificate ? { tls: { rejectUnauthorized: false } } : {}),
    }));

  return {
    async send(message: MailMessage) {
      const mail = renderMail(message);
      try {
        await transporter().sendMail({
          from,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
        });
      } catch {
        throw new MailFailedError();
      }
    },
  };
};
