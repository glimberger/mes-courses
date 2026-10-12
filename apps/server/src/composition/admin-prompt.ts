import type { Readable, Writable } from 'node:stream';

import { normalizeEmail, validateNewPassword } from '@mes-courses/sync-core';

import type { PasswordHasher } from '../application/ports/password-hasher';

/** Asks for a secret on the terminal. Injected, so the commands are tested without one. */
export interface PasswordPrompt {
  ask(label: string): Promise<string>;
}

/** A refusal the maintainer reads: English technical text, nothing from a password. */
export class CommandError extends Error {}

type TtyInput = Readable & {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};

/**
 * Reads one line without echoing it. On a terminal the keys are read raw (Enter ends, Backspace
 * erases, Ctrl-C aborts); from a pipe the first line is taken.
 */
export const terminalPrompt = (
  input: TtyInput = process.stdin,
  output: Writable = process.stdout,
): PasswordPrompt => ({
  ask: (label) =>
    new Promise((resolve, reject) => {
      output.write(label);
      const raw = input.isTTY === true && input.setRawMode !== undefined;
      if (raw) input.setRawMode?.(true);
      let typed = '';
      const finish = () => {
        input.off('data', onData);
        input.off('end', onEnd);
        if (raw) input.setRawMode?.(false);
        input.pause();
        output.write('\n');
      };
      const onEnd = () => {
        finish();
        resolve(typed);
      };
      const onData = (chunk: Buffer | string) => {
        for (const char of chunk.toString('utf8')) {
          if (char === '\r' || char === '\n') {
            finish();
            resolve(typed);
            return;
          }
          if (char === '\u0003') {
            finish();
            reject(new CommandError('aborted'));
            return;
          }
          if (char === '\u007f' || char === '\b') {
            typed = [...typed].slice(0, -1).join('');
          } else {
            typed += char;
          }
        }
      };
      input.on('data', onData);
      input.on('end', onEnd);
      input.resume();
    }),
});

/** The normalized address, or a refusal. */
export const requireEmail = (raw: string): string => {
  const email = normalizeEmail(raw);
  if (email === null) throw new CommandError('invalid email address');
  return email;
};

/**
 * Asks for the password twice and returns its hash, or a refusal: the two entries differ, or it
 * breaks the rules of FR-005. Nothing is written by this step.
 */
export const askNewPasswordHash = async (
  prompt: PasswordPrompt,
  hasher: PasswordHasher,
): Promise<string> => {
  const password = await prompt.ask('Password: ');
  const confirmation = await prompt.ask('Password again: ');
  if (password !== confirmation) {
    throw new CommandError('the two passwords differ');
  }
  const problem = validateNewPassword(password);
  if (problem !== null) {
    throw new CommandError(
      problem === 'TooShort'
        ? 'the password must have at least 12 characters'
        : 'the password must have at most 128 characters',
    );
  }
  return hasher.hash(password);
};
