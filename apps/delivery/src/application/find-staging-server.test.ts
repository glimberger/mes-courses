import type { ChannelManifest } from '../domain/manifest';
import {
  fetchStagingServer,
  findStagingServer,
  stagingServerFailure,
} from './find-staging-server';
import { Recorder } from './testing/recorder';
import {
  InMemoryChannelSource,
  InMemoryGitFacts,
} from './testing/in-memory-doubles';

const TAG_COMMIT = 'c'.repeat(40);
const BUILT = 'b'.repeat(40);
const SHA = 'f'.repeat(64);

const stagingManifest = (serverCommit: string, manifestCommit = TAG_COMMIT) =>
  JSON.stringify({
    schema: 1,
    environment: 'staging',
    sequence: 30,
    commit: manifestCommit,
    version: '1.2.0-staging.30',
    createdAt: '2026-10-01T08:00:00.000Z',
    run: { id: 1, url: 'https://github.com/o/r/actions/runs/1' },
    minAgentVersion: '1.0.0',
    server: {
      commit: serverCommit,
      sequence: 28,
      version: '1.2.0-staging.28',
      asset: `server-${serverCommit}.tar.gz`,
      sha256: SHA,
      nixpkgsRev: '1'.repeat(40),
    },
    fdroid: null,
  } satisfies ChannelManifest);

const setup = (serverCommit = TAG_COMMIT) => {
  const git = new InMemoryGitFacts();
  const source = new InMemoryChannelSource();
  source.channels.set('staging', {
    manifest: stagingManifest(serverCommit),
    signature: 'sig',
  });
  return { git, source, deps: { git, source } };
};

describe('findStagingServer', () => {
  it('takes the server entry built for the tagged commit itself', async () => {
    const { deps } = setup();
    const entry = await findStagingServer(deps, TAG_COMMIT);
    expect(entry).toMatchObject({ commit: TAG_COMMIT, sha256: SHA });
  });

  it('takes the entry of an earlier commit when the server did not change since', async () => {
    const { deps, git } = setup(BUILT);
    git.ancestry.add(`${BUILT}..${TAG_COMMIT}`);
    const entry = await findStagingServer(deps, TAG_COMMIT);
    expect(entry.commit).toBe(BUILT);
  });

  it('refuses when staging has no manifest', async () => {
    const { deps, source } = setup();
    source.channels.clear();
    await expect(findStagingServer(deps, TAG_COMMIT)).rejects.toThrow(
      /staging channel has no manifest/,
    );
  });

  it('refuses a manifest it cannot read', async () => {
    const { deps, source } = setup();
    source.channels.set('staging', { manifest: '{}', signature: 'sig' });
    await expect(findStagingServer(deps, TAG_COMMIT)).rejects.toThrow(
      /Invalid manifest/,
    );
  });

  it('refuses an archive that is not an ancestor of the tagged commit', async () => {
    const { deps } = setup(BUILT);
    await expect(findStagingServer(deps, TAG_COMMIT)).rejects.toThrow(
      new RegExp(`${BUILT}.*not.*ancestor.*${TAG_COMMIT}`),
    );
  });

  it('refuses when the server changed since the staging archive', async () => {
    const { deps, git } = setup(BUILT);
    git.ancestry.add(`${BUILT}..${TAG_COMMIT}`);
    git.serverChanges.add(`${BUILT}..${TAG_COMMIT}`);
    await expect(findStagingServer(deps, TAG_COMMIT)).rejects.toThrow(
      /server changed between/,
    );
  });

  it('never suggests a rebuild', async () => {
    const { deps, source } = setup();
    source.channels.clear();
    await expect(findStagingServer(deps, TAG_COMMIT)).rejects.not.toThrow(
      /rebuil/i,
    );
  });
});

describe('stagingServerFailure', () => {
  it('is null when the archive can be reused', async () => {
    const { deps } = setup();
    expect(await stagingServerFailure(deps, TAG_COMMIT)).toBeNull();
  });

  it('is the message of the refusal', async () => {
    const { deps, source } = setup();
    source.channels.clear();
    expect(await stagingServerFailure(deps, TAG_COMMIT)).toMatch(
      /staging channel has no manifest/,
    );
  });
});

describe('fetchStagingServer', () => {
  it('downloads the asset the manifest names, under the tagged commit name', async () => {
    const recorder = new Recorder();
    const git = new InMemoryGitFacts();
    const source = new InMemoryChannelSource(recorder);
    source.channels.set('staging', {
      manifest: stagingManifest(BUILT),
      signature: 'sig',
    });
    git.ancestry.add(`${BUILT}..${TAG_COMMIT}`);
    await fetchStagingServer(
      { git, source, hashFile: async () => SHA },
      TAG_COMMIT,
      '/out',
    );
    expect(recorder.calls).toContain(
      `ChannelSource.downloadAsset staging server-${BUILT}.tar.gz /out/server-${TAG_COMMIT}.tar.gz`,
    );
  });

  it('downloads nothing when the lookup refuses', async () => {
    const recorder = new Recorder();
    const source = new InMemoryChannelSource(recorder);
    await expect(
      fetchStagingServer(
        { git: new InMemoryGitFacts(), source, hashFile: async () => SHA },
        TAG_COMMIT,
        '/out',
      ),
    ).rejects.toThrow();
    expect(recorder.calls.some((c) => c.includes('downloadAsset'))).toBe(false);
  });

  it('returns the entry and the archive path when the checksum matches', async () => {
    const { deps, git } = setup(BUILT);
    git.ancestry.add(`${BUILT}..${TAG_COMMIT}`);
    const result = await fetchStagingServer(
      { ...deps, hashFile: async () => SHA },
      TAG_COMMIT,
      '/out',
    );
    expect(result.archive).toBe(`/out/server-${TAG_COMMIT}.tar.gz`);
    expect(result.entry.commit).toBe(BUILT);
  });

  it('fails when the downloaded archive differs from the manifest checksum', async () => {
    const { deps } = setup();
    await expect(
      fetchStagingServer(
        { ...deps, hashFile: async () => '0'.repeat(64) },
        TAG_COMMIT,
        '/out',
      ),
    ).rejects.toThrow(/checksum/i);
  });
});
