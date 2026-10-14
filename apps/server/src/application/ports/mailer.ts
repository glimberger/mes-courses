import type { Instant } from './instant';

export type MailMessage =
  | {
      kind: 'invitation';
      to: string;
      temporaryPassword: string;
      expiresAt: Instant;
      serverUrl: string;
    }
  | {
      kind: 'newTemporaryPassword';
      to: string;
      temporaryPassword: string;
      expiresAt: Instant;
    };

/** Fixed message: nothing from the mail library, which can contain the recipient (research R8). */
export class MailFailedError extends Error {
  constructor() {
    super('MailFailed');
  }
}

export interface Mailer {
  /** Throws `MailFailedError`. */
  send(message: MailMessage): Promise<void>;
}
