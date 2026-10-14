import {
  MailFailedError,
  type Mailer,
  type MailMessage,
} from '../ports/mailer';

export type FakeMailer = Mailer & {
  /** What was sent, in order. */
  readonly sent: MailMessage[];
  /** The next sends throw `MailFailedError`. */
  failing: boolean;
  /** Holds every send until `release()`, to test what happens meanwhile. */
  hold(): void;
  release(): void;
};

export const createFakeMailer = (): FakeMailer => {
  const sent: MailMessage[] = [];
  let gate: Promise<void> | null = null;
  let open: (() => void) | null = null;
  const mailer: FakeMailer = {
    sent,
    failing: false,
    async send(message) {
      if (gate !== null) await gate;
      if (mailer.failing) throw new MailFailedError();
      sent.push(message);
    },
    hold() {
      gate = new Promise<void>((resolve) => {
        open = resolve;
      });
    },
    release() {
      open?.();
      gate = null;
      open = null;
    },
  };
  return mailer;
};
