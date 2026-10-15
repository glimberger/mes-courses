import { parseManifest, type ChannelManifest } from '../domain/manifest';
import {
  FakeClock,
  FakeSigner,
  InMemoryChannelPublisher,
  InMemoryChannelSource,
} from './testing/in-memory-doubles';
import { Recorder } from './testing/recorder';
import { writeManifest, type WriteManifestInput } from './write-manifest';

const COMMIT = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const NIXPKGS = 'c'.repeat(40);
const SHA = 'd'.repeat(64);

const setup = () => {
  const recorder = new Recorder();
  const source = new InMemoryChannelSource(recorder);
  const publisher = new InMemoryChannelPublisher(recorder);
  const signer = new FakeSigner(recorder);
  const clock = new FakeClock();
  const deps = { source, publisher, signer, clock };
  return { recorder, source, publisher, deps };
};

const input = (
  change: Partial<WriteManifestInput> = {},
): WriteManifestInput => ({
  environment: 'staging',
  commit: COMMIT,
  sequence: 412,
  version: '1.2.0',
  nixpkgsRev: NIXPKGS,
  minAgentVersion: '1.0.0',
  run: { id: 7, url: 'https://github.com/o/r/actions/runs/7' },
  server: { path: `/tmp/server-${COMMIT}.tar.gz`, sha256: SHA },
  ...change,
});

const published = (recorder: Recorder) =>
  recorder.calls.find((c) => c.startsWith('ChannelPublisher.uploadManifest'));

const manifestOf = (recorder: Recorder): ChannelManifest => {
  const call = published(recorder) as string;
  return parseManifest(
    call.slice(call.indexOf(' ', call.indexOf(' ') + 1) + 1),
  );
};

const existing = (): ChannelManifest => ({
  schema: 1,
  environment: 'staging',
  sequence: 409,
  commit: OLD,
  version: '1.2.0-staging.409',
  createdAt: '2026-10-19T08:00:00.000Z',
  run: { id: 1, url: 'https://github.com/o/r/actions/runs/1' },
  minAgentVersion: '1.0.0',
  server: {
    commit: OLD,
    sequence: 409,
    version: '1.2.0-staging.409',
    asset: `server-${OLD}.tar.gz`,
    sha256: SHA,
    nixpkgsRev: NIXPKGS,
  },
  fdroid: null,
});

const channel = (manifest: ChannelManifest) => ({
  manifest: JSON.stringify(manifest),
  signature: 'signed',
});

describe('writeManifest', () => {
  it('writes a first staging manifest with the server built', async () => {
    const { deps, recorder } = setup();
    await writeManifest(deps, input());
    const manifest = manifestOf(recorder);
    expect(manifest.version).toBe('1.2.0-staging.412');
    expect(manifest.server).toEqual({
      commit: COMMIT,
      sequence: 412,
      version: '1.2.0-staging.412',
      asset: `server-${COMMIT}.tar.gz`,
      sha256: SHA,
      nixpkgsRev: NIXPKGS,
    });
    expect(manifest.fdroid).toBeNull();
    expect(manifest.createdAt).toBe('2026-10-20T08:00:00.000Z');
  });

  it('uploads the assets, then the signature, then the manifest', async () => {
    const { deps, recorder } = setup();
    await writeManifest(
      deps,
      input({
        fdroid: { path: `/tmp/fdroid-staging-${COMMIT}.tar.gz`, sha256: SHA },
      }),
    );
    const order = recorder.calls
      .filter((c) => c.startsWith('ChannelPublisher.upload'))
      .map((c) => c.split(' ')[0]);
    expect(order).toEqual([
      'ChannelPublisher.uploadAsset',
      'ChannelPublisher.uploadAsset',
      'ChannelPublisher.uploadSignature',
      'ChannelPublisher.uploadManifest',
    ]);
  });

  it('signs exactly the manifest it uploads', async () => {
    const { deps, recorder } = setup();
    await writeManifest(deps, input());
    const signature = recorder.calls.find((c) =>
      c.startsWith('ChannelPublisher.uploadSignature'),
    ) as string;
    const manifest = (published(recorder) as string).replace(
      'ChannelPublisher.uploadManifest staging ',
      '',
    );
    expect(signature).toBe(
      `ChannelPublisher.uploadSignature staging signed:${manifest}`,
    );
  });

  it('refuses to overwrite a newer manifest with an older run', async () => {
    const { deps, source, recorder } = setup();
    source.channels.set('staging', channel(existing()));
    await expect(writeManifest(deps, input({ sequence: 400 }))).rejects.toThrow(
      'is older',
    );
    expect(published(recorder)).toBeUndefined();
  });

  it('accepts a re-run of the commit the channel is already at', async () => {
    const { deps, source, recorder } = setup();
    source.channels.set('staging', channel(existing()));
    await writeManifest(deps, input({ commit: OLD, sequence: 409 }));
    expect(manifestOf(recorder).sequence).toBe(409);
  });

  it('replaces only the app entry and carries the server over', async () => {
    const { deps, source, recorder } = setup();
    source.channels.set('staging', channel(existing()));
    await writeManifest(
      deps,
      input({
        server: undefined,
        fdroid: { path: `/tmp/fdroid-staging-${COMMIT}.tar.gz`, sha256: SHA },
      }),
    );
    const manifest = manifestOf(recorder);
    expect(manifest.server).toEqual(existing().server);
    expect(manifest.fdroid).toEqual({
      commit: COMMIT,
      versionCode: 412,
      asset: `fdroid-staging-${COMMIT}.tar.gz`,
      sha256: SHA,
    });
    expect(manifest.sequence).toBe(412);
  });

  it('replaces only the server entry and carries the app over', async () => {
    const { deps, source, recorder } = setup();
    const before = {
      ...existing(),
      fdroid: {
        commit: OLD,
        versionCode: 409,
        asset: `fdroid-staging-${OLD}.tar.gz`,
        sha256: SHA,
      },
    };
    source.channels.set('staging', channel(before));
    await writeManifest(deps, input());
    expect(manifestOf(recorder).fdroid).toEqual(before.fdroid);
    expect(manifestOf(recorder).server.commit).toBe(COMMIT);
  });

  it('fails without a current manifest and without a server', async () => {
    const { deps, recorder } = setup();
    await expect(
      writeManifest(
        deps,
        input({
          server: undefined,
          fdroid: { path: `/tmp/fdroid-staging-${COMMIT}.tar.gz`, sha256: SHA },
        }),
      ),
    ).rejects.toThrow(/first manifest/i);
    expect(recorder.calls.some((c) => c.includes('upload'))).toBe(false);
  });

  it('fails when nothing was built', async () => {
    const { deps } = setup();
    await expect(
      writeManifest(deps, input({ server: undefined })),
    ).rejects.toThrow();
  });

  it('uses the tag version in production, for the manifest and the server', async () => {
    const { deps, recorder } = setup();
    await writeManifest(
      deps,
      input({ environment: 'production', version: '1.3.0' }),
    );
    const manifest = manifestOf(recorder);
    expect(manifest.version).toBe('1.3.0');
    expect(manifest.server.version).toBe('1.3.0');
  });

  it('rejects a staging version that already has a suffix', async () => {
    const { deps } = setup();
    await expect(
      writeManifest(deps, input({ version: '1.2.0-staging.4' })),
    ).rejects.toThrow();
  });

  it('prunes what neither the new nor the previous manifest references', async () => {
    const { deps, source, recorder } = setup();
    source.channels.set('staging', channel(existing()));
    await writeManifest(deps, input());
    const prune = recorder.calls.find((c) =>
      c.startsWith('ChannelPublisher.prune'),
    ) as string;
    expect(prune).toContain(`server-${COMMIT}.tar.gz`);
    expect(prune).toContain(`server-${OLD}.tar.gz`);
    expect(recorder.calls.indexOf(prune)).toBeGreaterThan(
      recorder.calls.findIndex((c) =>
        c.startsWith('ChannelPublisher.uploadManifest'),
      ),
    );
  });

  it('keeps the asset names that the manifest references', async () => {
    const { deps, recorder } = setup();
    await writeManifest(deps, input());
    expect(recorder.calls).toContain(
      `ChannelPublisher.uploadAsset staging /tmp/server-${COMMIT}.tar.gz`,
    );
  });
});
