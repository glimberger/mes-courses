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

  it('asks git whether a commit is an ancestor of another', async () => {
    const { calls, runner } = scripted([{ exitCode: 0 }, { exitCode: 1 }]);
    const facts = createGitFacts(runner, '/repo');
    expect(await facts.isAncestor('a', COMMIT)).toBe(true);
    expect(await facts.isAncestor('c', COMMIT)).toBe(false);
    expect(calls[0]?.args).toEqual([
      'merge-base',
      '--is-ancestor',
      'a',
      COMMIT,
    ]);
  });

  it('fails when git cannot tell the ancestry', async () => {
    const { runner } = scripted([{ exitCode: 128, stderr: 'bad object' }]);
    await expect(
      createGitFacts(runner, '/repo').isAncestor('a', COMMIT),
    ).rejects.toThrow(/bad object/);
  });

  it.each([
    ['server=true\napp=false\n', true],
    ['server=false\napp=true\n', false],
  ])(
    'reads %p from the delivery targets as server changed: %p',
    async (stdout, expected) => {
      const { calls, runner } = scripted([{ exitCode: 0, stdout }]);
      const changed = await createGitFacts(
        runner,
        '/repo',
      ).serverChangedBetween('a', COMMIT);
      expect(changed).toBe(expected);
      expect(calls[0]?.command).toBe('sh');
      expect(calls[0]?.args.slice(-2)).toEqual(['a', COMMIT]);
      expect(calls[0]?.args[1]).toContain('delivery-targets.sh');
    },
  );

  it('fails when the diff cannot be read', async () => {
    const { runner } = scripted([
      { exitCode: 128, stderr: 'unknown revision' },
    ]);
    await expect(
      createGitFacts(runner, '/repo').serverChangedBetween('a', COMMIT),
    ).rejects.toThrow(/unknown revision/);
  });
});
