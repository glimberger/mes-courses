import type {
  CommandResult,
  CommandRunner,
} from '../../application/ports/command-runner';
import { createGitFacts } from './git-facts';

const COMMIT = 'b'.repeat(40);

const scripted = (results: Partial<CommandResult>[]) => {
  const calls: { command: string; args: string[]; cwd?: string }[] = [];
  const runner: CommandRunner = {
    async run(command, args, options) {
      calls.push({ command, args, cwd: options?.cwd });
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
        ...results.shift(),
      };
    },
  };
  return { calls, runner };
};

describe('git facts', () => {
  it('asks git whether the commit is an ancestor of origin/main', async () => {
    const { calls, runner } = scripted([{ exitCode: 0 }]);
    expect(await createGitFacts(runner, '/repo').isOnMain(COMMIT)).toBe(true);
    expect(calls[0]).toEqual({
      command: 'git',
      args: ['merge-base', '--is-ancestor', COMMIT, 'origin/main'],
      cwd: '/repo',
    });
  });

  it('says false when the commit is not an ancestor', async () => {
    const { runner } = scripted([{ exitCode: 1 }]);
    expect(await createGitFacts(runner, '/repo').isOnMain(COMMIT)).toBe(false);
  });

  it('fails, rather than says false, when git itself fails', async () => {
    const { runner } = scripted([{ exitCode: 128, stderr: 'bad object' }]);
    await expect(
      createGitFacts(runner, '/repo').isOnMain(COMMIT),
    ).rejects.toThrow(/bad object/);
  });

  it('reads the app version with expo config at the tagged commit', async () => {
    const { calls, runner } = scripted([
      { stdout: `${COMMIT}\n` },
      { stdout: JSON.stringify({ name: 'x', version: '1.2.0' }) },
    ]);
    expect(await createGitFacts(runner, '/repo').appVersionAt(COMMIT)).toBe(
      '1.2.0',
    );
    expect(calls[1]).toEqual({
      command: 'npx',
      args: ['expo', 'config', '--json', '--type', 'public'],
      cwd: '/repo/apps/mobile',
    });
  });

  it('refuses to read the version of a commit that is not checked out', async () => {
    const { runner } = scripted([{ stdout: `${'d'.repeat(40)}\n` }]);
    await expect(
      createGitFacts(runner, '/repo').appVersionAt(COMMIT),
    ).rejects.toThrow(/not at the tagged commit/);
  });

  it('fails when expo config fails', async () => {
    const { runner } = scripted([
      { stdout: `${COMMIT}\n` },
      { exitCode: 1, stderr: 'boom' },
    ]);
    await expect(
      createGitFacts(runner, '/repo').appVersionAt(COMMIT),
    ).rejects.toThrow(/boom/);
  });
});
