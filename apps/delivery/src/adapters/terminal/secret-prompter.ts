import type { SecretPrompter } from '../../application/ports/secret-prompter';

type TerminalInput = NodeJS.ReadableStream & {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};

/** Asks for a secret on a terminal with no echo; `input` and `output` are injected (the process streams in production). */
export const createTerminalSecretPrompter = (
  input: TerminalInput,
  output: NodeJS.WritableStream,
): SecretPrompter => ({
  askSecret(question) {
    if (!input.isTTY) {
      return Promise.reject(
        new Error(
          `"${question.trim()}" needs a terminal: run the command from an interactive shell.`,
        ),
      );
    }
    output.write(question);
    return new Promise<string>((resolve, reject) => {
      let secret = '';
      // Skips escape sequences (arrow keys, Delete) across chunks: ESC, then `[` and up to a final byte.
      let escape: 'none' | 'esc' | 'csi' = 'none';
      const finish = (done: () => void) => {
        input.removeListener('data', onData);
        input.removeListener('end', onEnd);
        input.removeListener('error', onError);
        input.setRawMode?.(false);
        input.pause();
        output.write('\n');
        done();
      };
      const onData = (chunk: Buffer | string) => {
        for (const char of chunk.toString()) {
          if (escape === 'esc') {
            escape = char === '[' ? 'csi' : 'none';
            continue;
          }
          if (escape === 'csi') {
            if (char >= '@' && char <= '~') escape = 'none';
            continue;
          }
          if (char === '\u001b') {
            escape = 'esc';
            continue;
          }
          if (char === '\r' || char === '\n') {
            return finish(() => resolve(secret));
          }
          if (char === '\u0003' || char === '\u0004') {
            return finish(() => reject(new Error('Cancelled by the user')));
          }
          if (char === '\u007f' || char === '\b') secret = secret.slice(0, -1);
          else secret += char;
        }
      };
      const onEnd = () =>
        finish(() =>
          reject(new Error('The input ended before a password was given')),
        );
      const onError = (error: Error) => finish(() => reject(error));
      input.setRawMode?.(true);
      input.resume();
      input.on('data', onData);
      input.on('end', onEnd);
      input.on('error', onError);
    });
  },
});
