import { ScriptedCommandRunner } from '../../application/testing/in-memory-doubles';
import { createGithubAgentReleases } from './agent-releases';

const asset = (version: string, id = 7) => ({
  id,
  name: `delivery-${version}.tar.gz`,
});

describe('github agent releases', () => {
  it('takes the highest vX.Y.Z release by semver, ignoring channels, drafts and prereleases', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({
      stdout: JSON.stringify([
        { tag_name: 'channel-staging', assets: [asset('9.9.9', 1)] },
        { tag_name: 'v2.10.0', draft: true, assets: [asset('1.3.0', 2)] },
        { tag_name: 'v2.3.0', prerelease: true, assets: [asset('1.3.0', 3)] },
        { tag_name: 'v2.9.0', assets: [asset('1.1.0', 4)] },
        { tag_name: 'v2.2.0', assets: [asset('1.0.0', 5)] },
      ]),
    });
    await expect(
      createGithubAgentReleases(runner, '/repo').resolve(),
    ).resolves.toEqual({
      tag: 'v2.9.0',
      agentVersion: '1.1.0',
      assetId: 4,
      assetName: 'delivery-1.1.0.tar.gz',
    });
  });

  it('sorts numerically, not alphabetically', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({
      stdout: JSON.stringify([
        { tag_name: 'v2.9.0', assets: [asset('1.0.0', 1)] },
        { tag_name: 'v2.10.0', assets: [asset('1.1.0', 2)] },
      ]),
    });
    const release = await createGithubAgentReleases(runner, '/repo').resolve();
    expect(release.tag).toBe('v2.10.0');
  });

  it('reads the requested release', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({
      stdout: JSON.stringify({ tag_name: 'v2.2.0', assets: [asset('1.0.0')] }),
    });
    const release = await createGithubAgentReleases(runner, '/repo').resolve(
      '2.2.0',
    );
    expect(release).toMatchObject({ tag: 'v2.2.0', agentVersion: '1.0.0' });
    expect(runner.results).toHaveLength(0);
  });

  it('fails when the release has no agent bundle', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({
      stdout: JSON.stringify({
        tag_name: 'v2.2.0',
        assets: [{ id: 1, name: 'server.tar.gz' }],
      }),
    });
    await expect(
      createGithubAgentReleases(runner, '/repo').resolve('2.2.0'),
    ).rejects.toThrow(/no delivery/);
  });

  it('fails when there is no release, or gh fails', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ stdout: '[]' }, { exitCode: 1, stderr: 'HTTP 404' });
    const releases = createGithubAgentReleases(runner, '/repo');
    await expect(releases.resolve()).rejects.toThrow(/No release/);
    await expect(releases.resolve('9.9.9')).rejects.toThrow(/404/);
  });
});
