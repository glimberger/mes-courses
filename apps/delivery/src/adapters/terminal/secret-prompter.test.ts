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

  it('rejects on Ctrl-D', async () => {
    const { input, prompter } = setup(true);
    const answer = prompter.askSecret('Password: ');
    input.write('ab\u0004');
    await expect(answer).rejects.toThrow(/cancel/i);
  });

  it('ignores escape sequences, even split across chunks', async () => {
    const { input, prompter } = setup(true);
    const answer = prompter.askSecret('Password: ');
    input.write('ab\u001b[D');
    input.write('\u001b');
    input.write('[3~c\r');
    expect(await answer).toBe('abc');
  });

  it('fails clearly without a terminal, without reading', async () => {
    const { prompter } = setup(false);
    await expect(prompter.askSecret('Password: ')).rejects.toThrow(
      /needs a terminal/,
    );
  });

  it('rejects and restores the terminal when the input ends', async () => {
    const { input, prompter } = setup(true);
    const setRawMode = jest.fn();
    (input as unknown as { setRawMode: unknown }).setRawMode = setRawMode;
    const answer = prompter.askSecret('Password: ');
    input.end();
    await expect(answer).rejects.toThrow(/input ended/i);
    expect(setRawMode).toHaveBeenLastCalledWith(false);
  });

  it('rejects and restores the terminal when the input errors', async () => {
    const { input, prompter } = setup(true);
    const setRawMode = jest.fn();
    (input as unknown as { setRawMode: unknown }).setRawMode = setRawMode;
    const answer = prompter.askSecret('Password: ');
    input.emit('error', new Error('boom'));
    await expect(answer).rejects.toThrow(/boom/);
    expect(setRawMode).toHaveBeenLastCalledWith(false);
  });
});
