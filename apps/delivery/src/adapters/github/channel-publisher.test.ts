import type {
  CommandResult,
  CommandRunner,
} from '../../application/ports/command-runner';
import { createGithubChannelPublisher } from './channel-publisher';

const recording = (results: Partial<CommandResult>[] = []) => {
  const calls: string[][] = [];
  const runner: CommandRunner = {
    async run(command, args) {
      calls.push([command, ...args]);
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

describe('github channel publisher', () => {
  it('uploads an asset with --clobber to the channel release', async () => {
    const { calls, runner } = recording();
    await createGithubChannelPublisher(runner, 'o/r').uploadAsset(
      'staging',
      '/tmp/server-a.tar.gz',
    );
    expect(calls.at(-1)).toEqual([
      'gh',
      'release',
      'upload',
      'channel-staging',
      '/tmp/server-a.tar.gz',
      '--clobber',
      '--repo',
      'o/r',
    ]);
  });

  it('creates the channel release when it does not exist yet', async () => {
    const { calls, runner } = recording([{ exitCode: 1 }]);
    await createGithubChannelPublisher(runner, 'o/r').uploadAsset(
      'production',
      '/tmp/x.tar.gz',
    );
    expect(calls[1].slice(0, 4)).toEqual([
      'gh',
      'release',
      'create',
      'channel-production',
    ]);
    expect(calls[1]).toContain('--prerelease');
  });

  it('uploads the manifest under its fixed name', async () => {
    const { calls, runner } = recording();
    await createGithubChannelPublisher(runner, 'o/r').uploadManifest(
      'staging',
      '{}',
    );
    expect(calls[0][4]).toMatch(/\/manifest\.json$/);
  });

  it('deletes the assets that are not referenced, never the manifest files', async () => {
    const { calls, runner } = recording([
      {
        stdout:
          'manifest.json\nmanifest.json.sig\nserver-new.tar.gz\nserver-old.tar.gz\n',
      },
    ]);
    await createGithubChannelPublisher(runner, 'o/r').prune('staging', [
      'server-new.tar.gz',
    ]);
    const deletions = calls.filter((call) => call[2] === 'delete-asset');
    expect(deletions).toHaveLength(1);
    expect(deletions[0]).toContain('server-old.tar.gz');
  });

  it('fails with the gh error', async () => {
    const { runner } = recording([
      { exitCode: 0 },
      { exitCode: 1, stderr: 'boom' },
    ]);
    await expect(
      createGithubChannelPublisher(runner, 'o/r').uploadAsset('staging', '/x'),
    ).rejects.toThrow(/boom/);
  });
});
