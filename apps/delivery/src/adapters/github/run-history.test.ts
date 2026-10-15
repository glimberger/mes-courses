import type {
  CommandResult,
  CommandRunner,
} from '../../application/ports/command-runner';
import { createGithubRunHistory } from './run-history';

const scripted = (results: Partial<CommandResult>[]) => {
  const calls: string[][] = [];
  const runner: CommandRunner = {
    async run(command, args) {
      calls.push([command, ...args]);
      return {
        exitCode: 0,
        stdout: '[]',
        stderr: '',
        timedOut: false,
        ...results.shift(),
      };
    },
  };
  return { calls, runner };
};

describe('github run history', () => {
  it('asks gh for each workflow on the commit', async () => {
    const { calls, runner } = scripted([]);
    await createGithubRunHistory(runner, 'o/r', [
      'CI',
      'E2E Android',
    ]).successfulWorkflows('a'.repeat(40));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual([
      'gh',
      'run',
      'list',
      '--repo',
      'o/r',
      '--commit',
      'a'.repeat(40),
      '--workflow',
      'E2E Android',
      '--json',
      'conclusion',
      '--limit',
      '50',
    ]);
  });

  it('keeps the workflows with at least one successful run', async () => {
    const { runner } = scripted([
      { stdout: '[{"conclusion":"failure"},{"conclusion":"success"}]' },
      { stdout: '[{"conclusion":"failure"}]' },
      { stdout: '[]' },
    ]);
    expect(
      await createGithubRunHistory(runner, 'o/r', [
        'CI',
        'E2E Android',
        'Deliver staging',
      ]).successfulWorkflows('a'.repeat(40)),
    ).toEqual(['CI']);
  });

  it('fails when gh fails, rather than reporting no success', async () => {
    const { runner } = scripted([{ exitCode: 1, stderr: 'no auth' }]);
    await expect(
      createGithubRunHistory(runner, 'o/r', ['CI']).successfulWorkflows('a'),
    ).rejects.toThrow(/no auth/);
  });
});
