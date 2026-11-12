import { PassThrough } from 'node:stream';

import { createTerminalSecretPrompter } from './secret-prompter';

const setup = (isTTY: boolean) => {
  const input = new PassThrough() as PassThrough & { isTTY?: boolean };
  input.isTTY = isTTY;
  const output = new PassThrough();
  let written = '';
  output.on('data', (chunk) => (written += chunk));
  return {
    input,
    prompter: createTerminalSecretPrompter(input, output),
    written: () => written,
  };
};

describe('terminal secret prompter', () => {
  it('prints the question, never echoes the secret and returns it', async () => {
    const { input, prompter, written } = setup(true);
    const answer = prompter.askSecret('Password: ');
    input.write('hun');
    input.write('ter2\r');
    expect(await answer).toBe('hunter2');
    expect(written()).toContain('Password: ');
    expect(written()).not.toContain('hunter2');
  });

  it('honours backspace', async () => {
    const { input, prompter } = setup(true);
    const answer = prompter.askSecret('Password: ');
    input.write('abx\u007fc\n');
    expect(await answer).toBe('abc');
  });

  it('rejects on Ctrl-C', async () => {
    const { input, prompter } = setup(true);
    const answer = prompter.askSecret('Password: ');
    input.write('\u0003');
    await expect(answer).rejects.toThrow(/cancel/i);
  });

  it('fails clearly without a terminal, without reading', async () => {
    const { prompter } = setup(false);
    await expect(prompter.askSecret('Password: ')).rejects.toThrow(
      /needs a terminal/,
    );
  });
});
