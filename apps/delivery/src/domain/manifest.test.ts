import { parseManifest } from './manifest';

const COMMIT = 'a'.repeat(40);
const SHA = 'b'.repeat(64);

const valid = () => ({
  schema: 1,
  environment: 'staging',
  sequence: 412,
  commit: COMMIT,
  version: '1.2.0-staging.412',
  createdAt: '2026-10-20T08:14:03Z',
  run: {
    id: 18452231,
    url: 'https://github.com/glimberger/mes-courses/actions/runs/18452231',
  },
  minAgentVersion: '1.0.0',
  server: {
    commit: 'c'.repeat(40),
    sequence: 409,
    version: '1.2.0-staging.409',
    asset: `server-${'c'.repeat(40)}.tar.gz`,
    sha256: SHA,
    nixpkgsRev: 'd'.repeat(40),
  },
  fdroid: {
    commit: COMMIT,
    versionCode: 412,
    asset: 'fdroid-staging-abc.tar.gz',
    sha256: SHA,
  },
});

// The tests break the manifest in arbitrary ways, so its shape is not checked here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
const parse = (change: (m: Json) => void) => {
  const manifest: Json = valid();
  change(manifest);
  return () => parseManifest(JSON.stringify(manifest));
};

describe('parseManifest', () => {
  it('accepts a valid staging manifest', () => {
    const manifest = parseManifest(JSON.stringify(valid()));
    expect(manifest).toEqual(valid());
  });

  it('accepts a null fdroid entry', () => {
    expect(parse((m) => (m.fdroid = null))().fdroid).toBeNull();
  });

  it('accepts a production manifest with a plain version', () => {
    const manifest = parse((m) => {
      m.environment = 'production';
      m.version = '1.2.0';
      m.server.version = '1.2.0';
    })();
    expect(manifest.environment).toBe('production');
  });

  it('refuses text that is not JSON', () => {
    expect(() => parseManifest('{')).toThrow();
  });

  it('refuses an unknown schema', () => {
    expect(parse((m) => (m.schema = 2))).toThrow(/schema/);
  });

  it.each([
    'environment',
    'sequence',
    'commit',
    'version',
    'createdAt',
    'run',
    'minAgentVersion',
    'server',
  ])('refuses a missing %s', (field) => {
    expect(parse((m) => Reflect.deleteProperty(m, field))).toThrow(
      new RegExp(field),
    );
  });

  it('refuses an unknown environment', () => {
    expect(parse((m) => (m.environment = 'dev'))).toThrow(/environment/);
  });

  it.each([0, -1, 1.5, '412'])('refuses the sequence %p', (sequence) => {
    expect(parse((m) => (m.sequence = sequence))).toThrow(/sequence/);
  });

  it.each(['A'.repeat(40), 'a'.repeat(39), 'a'.repeat(41), 'g'.repeat(40)])(
    'refuses the commit %p',
    (commit) => {
      expect(parse((m) => (m.commit = commit))).toThrow(/commit/);
    },
  );

  it('refuses a nixpkgsRev that is not 40 lowercase hex characters', () => {
    expect(parse((m) => (m.server.nixpkgsRev = 'abc'))).toThrow(/nixpkgsRev/);
  });

  it.each(['b'.repeat(63), 'B'.repeat(64), 'z'.repeat(64)])(
    'refuses the sha256 %p',
    (sha) => {
      expect(parse((m) => (m.server.sha256 = sha))).toThrow(/sha256/);
      expect(parse((m) => (m.fdroid.sha256 = sha))).toThrow(/sha256/);
    },
  );

  it('refuses a server sequence above the manifest sequence', () => {
    expect(parse((m) => (m.server.sequence = 413))).toThrow(/server\.sequence/);
  });

  it('refuses an fdroid versionCode above the manifest sequence', () => {
    expect(parse((m) => (m.fdroid.versionCode = 413))).toThrow(/versionCode/);
  });

  it.each([
    '../x.tar.gz',
    'a/b.tar.gz',
    '/etc/x.tar.gz',
    'x.zip',
    '.x.tar.gz',
    'X.tar.gz',
    'x.tar.gz\n..',
  ])('refuses the asset name %p', (asset) => {
    expect(parse((m) => (m.server.asset = asset))).toThrow(/asset/);
    expect(parse((m) => (m.fdroid.asset = asset))).toThrow(/asset/);
  });

  it('refuses a staging version without its sequence suffix', () => {
    expect(parse((m) => (m.version = '1.2.0'))).toThrow(/version/);
  });

  it('refuses a staging version whose suffix is not the sequence', () => {
    expect(parse((m) => (m.version = '1.2.0-staging.411'))).toThrow(/version/);
  });

  it('refuses a production version with a suffix', () => {
    expect(
      parse((m) => {
        m.environment = 'production';
        m.version = '1.2.0-staging.412';
      }),
    ).toThrow(/version/);
  });

  it('refuses a wrongly typed run', () => {
    expect(parse((m) => (m.run = { id: '1', url: 'x' }))).toThrow(/run/);
  });

  it('refuses a minAgentVersion that is not a version', () => {
    expect(parse((m) => (m.minAgentVersion = 'latest'))).toThrow(
      /minAgentVersion/,
    );
  });
});
