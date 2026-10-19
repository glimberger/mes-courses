import type {
  CommandResult,
  CommandRunner,
} from '../../application/ports/command-runner';
import { createGithubReleasePullRequests } from './release-pull-requests';

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

const pr = (
  number: number,
  state: string,
  extra: Record<string, unknown> = {},
) => ({
  number,
  state,
  url: `https://github.com/o/r/pull/${number}`,
  mergeCommit: null,
  statusCheckRollup: [],
  autoMergeRequest: null,
  ...extra,
});

const BRANCH = 'chore/release-1.3.0';

describe('github release pull requests', () => {
  it('lists the pull requests of the branch with gh', async () => {
    const { calls, runner } = scripted([{ stdout: '[]' }]);
    expect(
      await createGithubReleasePullRequests(runner, '/repo').findBump(BRANCH),
    ).toBeNull();
    expect(calls[0]).toEqual({
      command: 'gh',
      args: [
        'pr',
        'list',
        '--head',
        BRANCH,
        '--state',
        'all',
        '--json',
        'number,state,url,mergeCommit,statusCheckRollup,autoMergeRequest',
      ],
      cwd: '/repo',
    });
  });

  it('prefers the open pull request over the others', async () => {
    const { runner } = scripted([
      {
        stdout: JSON.stringify([
          pr(1, 'CLOSED'),
          pr(2, 'OPEN'),
          pr(3, 'MERGED'),
        ]),
      },
    ]);
    expect(
      await createGithubReleasePullRequests(runner, '/repo').findBump(BRANCH),
    ).toEqual({
      state: 'open',
      url: 'https://github.com/o/r/pull/2',
      mergeCommit: null,
      checksFailed: false,
      autoMergeEnabled: false,
    });
  });

  it('tells whether auto-merge is already enabled on the pull request', async () => {
    const { runner } = scripted([
      {
        stdout: JSON.stringify([
          pr(2, 'OPEN', { autoMergeRequest: { mergeMethod: 'SQUASH' } }),
        ]),
      },
    ]);
    expect(
      (await createGithubReleasePullRequests(runner, '/repo').findBump(BRANCH))
        ?.autoMergeEnabled,
    ).toBe(true);
  });

  it('else takes the merged one, with its merge commit', async () => {
    const { runner } = scripted([
      {
        stdout: JSON.stringify([
          pr(1, 'CLOSED'),
          pr(3, 'MERGED', { mergeCommit: { oid: 'abc' } }),
        ]),
      },
    ]);
    expect(
      await createGithubReleasePullRequests(runner, '/repo').findBump(BRANCH),
    ).toEqual({
      state: 'merged',
      url: 'https://github.com/o/r/pull/3',
      mergeCommit: 'abc',
      checksFailed: false,
      autoMergeEnabled: false,
    });
  });

  it('else reports the closed one', async () => {
    const { runner } = scripted([
      { stdout: JSON.stringify([pr(1, 'CLOSED')]) },
    ]);
    expect(
      (await createGithubReleasePullRequests(runner, '/repo').findBump(BRANCH))
        ?.state,
    ).toBe('closed');
  });

  it('flags failed checks and ignores the ones still running', async () => {
    const { runner } = scripted([
      {
        stdout: JSON.stringify([
          pr(2, 'OPEN', {
            statusCheckRollup: [
              { conclusion: 'SUCCESS', status: 'COMPLETED' },
              { conclusion: '', status: 'IN_PROGRESS' },
              { conclusion: 'FAILURE', status: 'COMPLETED' },
            ],
          }),
        ]),
      },
      {
        stdout: JSON.stringify([
          pr(2, 'OPEN', {
            statusCheckRollup: [
              { conclusion: 'SUCCESS', status: 'COMPLETED' },
              { conclusion: '', status: 'IN_PROGRESS' },
            ],
          }),
        ]),
      },
    ]);
    const adapter = createGithubReleasePullRequests(runner, '/repo');
    expect((await adapter.findBump(BRANCH))?.checksFailed).toBe(true);
    expect((await adapter.findBump(BRANCH))?.checksFailed).toBe(false);
  });

  it('opens a pull request, then reads it back', async () => {
    const { calls, runner } = scripted([
      { stdout: 'https://github.com/o/r/pull/9\n' },
      { stdout: JSON.stringify([pr(9, 'OPEN')]) },
    ]);
    const opened = await createGithubReleasePullRequests(runner, '/repo').open(
      BRANCH,
      'chore(release): bump the app version to 1.3.0',
    );
    expect(calls[0].args.slice(0, 2)).toEqual(['pr', 'create']);
    expect(calls[0].args).toEqual(
      expect.arrayContaining([
        '--head',
        BRANCH,
        '--title',
        'chore(release): bump the app version to 1.3.0',
      ]),
    );
    expect(opened.url).toBe('https://github.com/o/r/pull/9');
    expect(opened.state).toBe('open');
  });

  it('enables auto-merge in squash mode and deletes the branch', async () => {
    const { calls, runner } = scripted([{}]);
    await createGithubReleasePullRequests(runner, '/repo').enableAutoMerge({
      state: 'open',
      url: 'https://github.com/o/r/pull/9',
      mergeCommit: null,
      checksFailed: false,
      autoMergeEnabled: false,
    });
    expect(calls[0].args).toEqual([
      'pr',
      'merge',
      'https://github.com/o/r/pull/9',
      '--auto',
      '--squash',
      '--delete-branch',
    ]);
  });

  it('fails with the gh message when gh fails', async () => {
    const { runner } = scripted([{ exitCode: 1, stderr: 'not logged in' }]);
    await expect(
      createGithubReleasePullRequests(runner, '/repo').findBump(BRANCH),
    ).rejects.toThrow(/not logged in/);
  });
});
