import { createInterface } from 'node:readline/promises';

import type { Prompter } from '../../application/ports/prompter';

/** Asks questions on a terminal; `input` and `output` are injected (the process streams in production). */
export const createTerminalPrompter = (
  input: NodeJS.ReadableStream & { isTTY?: boolean },
  output: NodeJS.WritableStream,
): Prompter => {
  const ask = async (question: string): Promise<string> => {
    if (!input.isTTY) {
      throw new Error(
        `A question needs a terminal ("${question.trim()}"). Give the version on the command line and pass --yes to run without one.`,
      );
    }
    const lines = createInterface({ input, output, terminal: false });
    try {
      return await new Promise<string>((resolve, reject) => {
        lines.once('close', () =>
          reject(new Error('The input ended before an answer was given')),
        );
        lines.question(question).then(resolve, reject);
      }).then((answer) => answer.trim());
    } finally {
      lines.close();
    }
  };

  return {
    ask,
    async confirm(question) {
      return ['y', 'yes'].includes((await ask(question)).toLowerCase());
    },
  };
};
