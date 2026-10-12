import { SMTPServer } from 'smtp-server';
import type { AddressInfo } from 'node:net';

import { MailFailedError } from '../../application/ports/mailer';
import {
  createConsoleMailer,
  createUnconfiguredMailer,
} from './console-mailer';
import { createSmtpMailer } from './smtp-mailer';

const INVITATION = {
  kind: 'invitation',
  to: 'marie@example.org',
  temporaryPassword: 'ABCD-EFGH-JKMN-PQRS',
  expiresAt: '2026-10-19T10:00:00.000Z',
  serverUrl: 'https://courses.example.fr',
} as const;

type Received = { from: string; to: string[]; raw: string; secure: boolean };

const startSmtp = async ({ starttls }: { starttls: boolean }) => {
  const received: Received[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: starttls ? [] : ['STARTTLS'],
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        received.push({
          from: session.envelope.mailFrom
            ? session.envelope.mailFrom.address
            : '',
          to: session.envelope.rcptTo.map((r) => r.address),
          raw: Buffer.concat(chunks).toString('utf8'),
          secure: session.secure,
        });
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.server.address() as AddressInfo).port;
  return {
    received,
    url: `smtp://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(resolve)),
  };
};

describe('createSmtpMailer', () => {
  it('004 sends the French message over STARTTLS, with the public address of the server', async () => {
    const smtp = await startSmtp({ starttls: true });
    try {
      const mailer = createSmtpMailer({
        url: smtp.url,
        from: 'Mes courses <courses@example.fr>',
        trustAnyCertificate: true,
      });

      await mailer.send(INVITATION);

      expect(smtp.received).toHaveLength(1);
      const [mail] = smtp.received;
      expect(mail?.secure).toBe(true);
      expect(mail?.from).toBe('courses@example.fr');
      expect(mail?.to).toEqual(['marie@example.org']);
      expect(mail?.raw).toContain('Subject: =?UTF-8?');
      expect(mail?.raw).toContain('https://courses.example.fr');
      expect(mail?.raw).toContain('ABCD-EFGH-JKMN-PQRS');
    } finally {
      await smtp.close();
    }
  });

  it('004 refuses a server that does not offer STARTTLS, and sends nothing in clear', async () => {
    const smtp = await startSmtp({ starttls: false });
    try {
      const mailer = createSmtpMailer({
        url: smtp.url,
        from: 'courses@example.fr',
      });

      await expect(mailer.send(INVITATION)).rejects.toBeInstanceOf(
        MailFailedError,
      );
      expect(smtp.received).toHaveLength(0);
    } finally {
      await smtp.close();
    }
  });

  it('004 throws a fixed error that carries nothing from the mail library, not even the recipient', async () => {
    const mailer = createSmtpMailer({
      url: 'smtp://127.0.0.1:1',
      from: 'courses@example.fr',
    });

    const error = await mailer.send(INVITATION).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MailFailedError);
    expect((error as Error).message).toBe('MailFailed');
    expect(String((error as Error).stack)).not.toContain('marie@example.org');
  });
});

describe('createConsoleMailer', () => {
  it('004 prints the message, temporary password included', async () => {
    const printed: string[] = [];
    const mailer = createConsoleMailer((t) => printed.push(t));

    await mailer.send(INVITATION);

    expect(printed.join('\n')).toContain('ABCD-EFGH-JKMN-PQRS');
    expect(printed.join('\n')).toContain('https://courses.example.fr');
  });
});

describe('createUnconfiguredMailer', () => {
  it('004 fails every send with MailFailed', async () => {
    await expect(
      createUnconfiguredMailer().send(INVITATION),
    ).rejects.toBeInstanceOf(MailFailedError);
  });
});
