import { PassThrough } from 'node:stream';

import { createTerminalPrompter } from './prompter';

const setup = (isTTY: boolean) => {
  const input = new PassThrough() as PassThrough & { isTTY?: boolean };
  input.isTTY = isTTY;
  const output = new PassThrough();
  let written = '';
  output.on('data', (chunk) => (written += chunk));
  return {
    input,
    prompter: createTerminalPrompter(input, output),
    written: () => written,
  };
};

describe('terminal prompter', () => {
  it('prints the question and returns the trimmed answer', async () => {
    const { input, prompter, written } = setup(true);
    const answer = prompter.ask('Bump? ');
    input.write('  minor \n');
    expect(await answer).toBe('minor');
    expect(written()).toContain('Bump? ');
  });

  it.each(['y', 'Y', 'yes', 'YES', ' yes '])('confirms on %p', async (text) => {
    const { input, prompter } = setup(true);
    const answer = prompter.confirm('Go? ');
    input.write(`${text}\n`);
    expect(await answer).toBe(true);
  });

  it.each(['n', 'no', '', 'yep', 'ok'])('declines on %p', async (text) => {
    const { input, prompter } = setup(true);
    const answer = prompter.confirm('Go? ');
    input.write(`${text}\n`);
    expect(await answer).toBe(false);
  });

  it('explains how to avoid the question when input is not a terminal', async () => {
    const { prompter } = setup(false);
    await expect(prompter.ask('Bump? ')).rejects.toThrow(/terminal/);
    await expect(prompter.confirm('Go? ')).rejects.toThrow(/--yes/);
  });

  it('fails when the input ends before an answer', async () => {
    const { input, prompter } = setup(true);
    const answer = prompter.ask('Bump? ');
    input.end();
    await expect(answer).rejects.toThrow(/input/i);
  });
});
