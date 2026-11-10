import type { ChannelManifest } from '../domain/manifest';
import { releaseGate } from './release-gate';
import {
  FakeSigner,
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

const stagingManifest = (serverCommit: string): string =>
  JSON.stringify({
    schema: 1,
    environment: 'staging',
    sequence: 30,
    commit: serverCommit,
    version: '1.2.0-staging.30',
    createdAt: '2026-10-01T08:00:00.000Z',
    run: { id: 2, url: 'https://github.com/o/r/actions/runs/2' },
    minAgentVersion: '1.0.0',
    server: {
      commit: serverCommit,
      sequence: 30,
      version: '1.2.0-staging.30',
      asset: `server-${serverCommit}.tar.gz`,
      sha256: 'e'.repeat(64),
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
  const staging = stagingManifest(commit);
  source.channels.set('staging', {
    manifest: staging,
    signature: `signed:${staging}`,
  });
  return {
    deps: { git, runs, source, verifier: new FakeSigner() },
    git,
    runs,
    source,
  };
};

describe('releaseGate', () => {
  it('passes a validated commit with a higher version', async () => {
    const { deps } = setup();
    expect(await releaseGate(deps, { tag: 'v1.2.0', commit })).toEqual([]);
  });

  it('passes the first production release', async () => {
    const { deps, source } = setup();
    source.channels.delete('production');
    expect(await releaseGate(deps, { tag: 'v1.2.0', commit })).toEqual([]);
  });

  it('lists every broken rule', async () => {
    const { deps, git, runs } = setup();
    git.onMain.clear();
    runs.successes.set(commit, ['CI']);
    const failures = await releaseGate(deps, { tag: 'v1.1.0', commit });
    expect(failures).toHaveLength(5);
  });

  it('fails before anything is built when staging has no server archive to reuse', async () => {
    const { deps, source } = setup();
    source.channels.delete('staging');
    const failures = await releaseGate(deps, { tag: 'v1.2.0', commit });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/staging channel has no manifest/);
  });

  it('fails when the staging server archive is for another commit', async () => {
    const { deps, source } = setup();
    const other = stagingManifest('d'.repeat(40));
    source.channels.set('staging', {
      manifest: other,
      signature: `signed:${other}`,
    });
    const failures = await releaseGate(deps, { tag: 'v1.2.0', commit });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/not an ancestor/);
  });

  it('fails on a production manifest it cannot read', async () => {
    const { deps, source } = setup();
    source.channels.set('production', { manifest: '{}', signature: 'sig' });
    await expect(releaseGate(deps, { tag: 'v1.2.0', commit })).rejects.toThrow(
      /Invalid manifest/,
    );
  });
});
