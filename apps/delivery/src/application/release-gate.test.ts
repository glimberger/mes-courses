import type { ChannelManifest } from '../domain/manifest';
import { releaseGate } from './release-gate';
import {
  InMemoryChannelSource,
  InMemoryGitFacts,
  InMemoryRunHistory,
} from './testing/in-memory-doubles';

const commit = 'c'.repeat(40);

const productionManifest = (version: string): string =>
  JSON.stringify({
    schema: 1,
    environment: 'production',
    sequence: 20,
    commit: 'a'.repeat(40),
    version,
    createdAt: '2026-10-01T08:00:00.000Z',
    run: { id: 1, url: 'https://github.com/o/r/actions/runs/1' },
    minAgentVersion: '1.0.0',
    server: {
      commit: 'a'.repeat(40),
      sequence: 20,
      version,
      asset: `server-${'a'.repeat(40)}.tar.gz`,
      sha256: 'f'.repeat(64),
      nixpkgsRev: '1'.repeat(40),
    },
    fdroid: null,
  } satisfies ChannelManifest);

const setup = () => {
  const git = new InMemoryGitFacts();
  const runs = new InMemoryRunHistory();
  const source = new InMemoryChannelSource();
  git.onMain.add(commit);
  git.appVersions.set(commit, '1.2.0');
  runs.successes.set(commit, ['CI', 'E2E Android', 'Deliver staging']);
  source.channels.set('production', {
    manifest: productionManifest('1.1.0'),
    signature: 'sig',
  });
  return { deps: { git, runs, source }, git, runs, source };
};

describe('releaseGate', () => {
  it('passes a validated commit with a higher version', async () => {
    const { deps } = setup();
    expect(await releaseGate(deps, { tag: 'v1.2.0', commit })).toEqual([]);
  });

  it('passes the first production release', async () => {
    const { deps, source } = setup();
    source.channels.clear();
    expect(await releaseGate(deps, { tag: 'v1.2.0', commit })).toEqual([]);
  });

  it('lists every broken rule', async () => {
    const { deps, git, runs } = setup();
    git.onMain.clear();
    runs.successes.set(commit, ['CI']);
    const failures = await releaseGate(deps, { tag: 'v1.1.0', commit });
    expect(failures).toHaveLength(5);
  });

  it('fails on a production manifest it cannot read', async () => {
    const { deps, source } = setup();
    source.channels.set('production', { manifest: '{}', signature: 'sig' });
    await expect(releaseGate(deps, { tag: 'v1.2.0', commit })).rejects.toThrow(
      /Invalid manifest/,
    );
  });
});
