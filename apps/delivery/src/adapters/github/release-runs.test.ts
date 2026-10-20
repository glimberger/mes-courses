import type {
  CommandResult,
  CommandRunner,
} from '../../application/ports/command-runner';
import { createGithubReleaseRuns } from './release-runs';

const SHA = 'a'.repeat(40);

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

const runs = (
  ...list: { status: string; conclusion: string; url?: string }[]
) => JSON.stringify(list.map((r) => ({ url: 'https://x/run', ...r })));

const sleeps: number[] = [];
const sleep = async (ms: number) => {
  sleeps.push(ms);
};
beforeEach(() => {
  sleeps.length = 0;
});

describe('github release runs', () => {
  it('asks gh for each required workflow on the commit', async () => {
    const { calls, runner } = scripted([]);
    await createGithubReleaseRuns(runner, '/repo', sleep).requiredRuns(SHA);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual([
      'gh',
      'run',
      'list',
      '--commit',
      SHA,
      '--workflow',
      'CI',
      '--json',
      'conclusion,status,url',
      '--limit',
      '20',
    ]);
    expect(calls.map((call) => call[6])).toEqual([
      'CI',
      'E2E Android',
      'Deliver staging',
    ]);
  });

  it('follows the Release gate: any successful run passes, else pending, else failed', async () => {
    const { runner } = scripted([
      {
        stdout: runs(
          { status: 'completed', conclusion: 'failure', url: 'https://x/new' },
          { status: 'completed', conclusion: 'success', url: 'https://x/ci' },
        ),
      },
      {
        stdout: runs(
          { status: 'completed', conclusion: 'failure', url: 'https://x/e2e' },
          { status: 'completed', conclusion: 'cancelled' },
        ),
      },
      {
        stdout: runs(
          { status: 'in_progress', conclusion: '', url: 'https://x/d' },
          { status: 'completed', conclusion: 'failure' },
        ),
      },
    ]);
    expect(
      await createGithubReleaseRuns(runner, '/repo', sleep).requiredRuns(SHA),
    ).toEqual([
      { workflow: 'CI', state: 'success', url: 'https://x/ci' },
      { workflow: 'E2E Android', state: 'failed', url: 'https://x/e2e' },
      { workflow: 'Deliver staging', state: 'pending', url: 'https://x/d' },
    ]);
  });

  it('looks the three workflows up at the same time', async () => {
    let running = 0;
    let peak = 0;
    const runner: CommandRunner = {
      async run() {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        return { exitCode: 0, stdout: '[]', stderr: '', timedOut: false };
      },
    };
    await createGithubReleaseRuns(runner, '/repo', sleep).requiredRuns(SHA);
    expect(peak).toBe(3);
  });

  it('counts a workflow without a run as pending, without a link', async () => {
    const { runner } = scripted([
      { stdout: '[]' },
      { stdout: '[]' },
      { stdout: '[]' },
    ]);
    const outcomes = await createGithubReleaseRuns(
      runner,
      '/repo',
      sleep,
    ).requiredRuns(SHA);
    expect(outcomes.every((o) => o.state === 'pending' && o.url === null)).toBe(
      true,
    );
  });

  it('fails with the gh message when gh fails', async () => {
    const { runner } = scripted([{ exitCode: 1, stderr: 'rate limited' }]);
    await expect(
      createGithubReleaseRuns(runner, '/repo', sleep).requiredRuns(SHA),
    ).rejects.toThrow(/rate limited/);
  });

  it('polls for the Release run until it appears', async () => {
    const { calls, runner } = scripted([
      { stdout: '[]' },
      { stdout: '[]' },
      {
        stdout: runs({
          status: 'queued',
          conclusion: '',
          url: 'https://x/release',
        }),
      },
    ]);
    expect(
      await createGithubReleaseRuns(runner, '/repo', sleep).releaseRunUrl(SHA),
    ).toBe('https://x/release');
    expect(calls[0]).toContain('Release');
    expect(sleeps).toEqual([3000, 3000]);
  });

  it('falls back to the Actions page when no Release run shows up', async () => {
    const { runner } = scripted([
      ...Array.from({ length: 10 }, () => ({ stdout: '[]' })),
      { stdout: 'https://github.com/o/r\n' },
    ]);
    expect(
      await createGithubReleaseRuns(runner, '/repo', sleep).releaseRunUrl(SHA),
    ).toBe('https://github.com/o/r/actions');
    expect(sleeps.length).toBeGreaterThan(0);
  });
});
