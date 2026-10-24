import { parseCiArgs } from './ci';

const COMMIT = 'a'.repeat(40);

describe('parseCiArgs write-manifest', () => {
  it('reads every option', () => {
    expect(
      parseCiArgs(
        [
          'write-manifest',
          '--env',
          'staging',
          '--commit',
          COMMIT,
          '--server',
          'server.tar.gz',
          '--fdroid',
          'fdroid.tar.gz',
          '--version',
          '1.2.0',
        ],
        () => true,
      ),
    ).toEqual({
      command: 'write-manifest',
      environment: 'staging',
      commit: COMMIT,
      server: 'server.tar.gz',
      fdroid: 'fdroid.tar.gz',
      version: '1.2.0',
    });
  });

  it('accepts a run with only the app', () => {
    const parsed = parseCiArgs(
      [
        'write-manifest',
        '--env',
        'production',
        '--commit',
        COMMIT,
        '--fdroid',
        'f.tar.gz',
      ],
      () => true,
    );
    expect(parsed).toMatchObject({ server: undefined, fdroid: 'f.tar.gz' });
  });

  it('rejects a missing --env', () => {
    expect(() =>
      parseCiArgs(['write-manifest', '--commit', COMMIT], () => true),
    ).toThrow(/--env/);
  });

  it('rejects an unknown environment', () => {
    expect(() =>
      parseCiArgs(
        ['write-manifest', '--env', 'qa', '--commit', COMMIT],
        () => true,
      ),
    ).toThrow(/staging or production/);
  });

  it('rejects a missing or malformed --commit', () => {
    expect(() =>
      parseCiArgs(['write-manifest', '--env', 'staging'], () => true),
    ).toThrow(/--commit/);
    expect(() =>
      parseCiArgs(
        ['write-manifest', '--env', 'staging', '--commit', 'abc'],
        () => true,
      ),
    ).toThrow(/40/);
  });

  it('rejects a file that does not exist', () => {
    expect(() =>
      parseCiArgs(
        [
          'write-manifest',
          '--env',
          'staging',
          '--commit',
          COMMIT,
          '--server',
          'nope.tar.gz',
        ],
        () => false,
      ),
    ).toThrow(/nope\.tar\.gz/);
  });

  it('rejects an unknown command and an unknown option', () => {
    expect(() => parseCiArgs(['deploy'], () => true)).toThrow(/command/);
    expect(() =>
      parseCiArgs(
        ['write-manifest', '--env', 'staging', '--bogus', 'x'],
        () => true,
      ),
    ).toThrow(/--bogus/);
  });
});

describe('parseCiArgs release-gate', () => {
  it('reads the tag and the commit', () => {
    expect(
      parseCiArgs(
        ['release-gate', '--tag', 'v1.2.0', '--commit', COMMIT],
        () => true,
      ),
    ).toEqual({ command: 'release-gate', tag: 'v1.2.0', commit: COMMIT });
  });

  it('needs a tag and a well-formed commit', () => {
    expect(() =>
      parseCiArgs(['release-gate', '--commit', COMMIT], () => true),
    ).toThrow('--tag is required');
    expect(() =>
      parseCiArgs(['release-gate', '--tag', 'v1.2.0'], () => true),
    ).toThrow('--commit is required');
    expect(() =>
      parseCiArgs(
        ['release-gate', '--tag', 'v1.2.0', '--commit', 'main'],
        () => true,
      ),
    ).toThrow('40 lowercase hex');
  });

  it('refuses an option it does not know', () => {
    expect(() =>
      parseCiArgs(['release-gate', '--env', 'staging'], () => true),
    ).toThrow('Unknown option: --env');
  });
});

describe('parseCiArgs wait-health', () => {
  const args = [
    'wait-health',
    '--url',
    'https://courses.example.org/',
    '--commit',
    COMMIT,
    '--timeout',
    '1200',
  ];

  it('reads the options and drops the trailing slash', () => {
    expect(parseCiArgs(args, () => true)).toEqual({
      command: 'wait-health',
      url: 'https://courses.example.org',
      commit: COMMIT,
      timeoutSeconds: 1200,
    });
  });

  it('refuses an address that is not http, and a bad timeout', () => {
    expect(() =>
      parseCiArgs(
        [
          'wait-health',
          '--url',
          'courses',
          '--commit',
          COMMIT,
          '--timeout',
          '5',
        ],
        () => true,
      ),
    ).toThrow('--url must start with');
    expect(() =>
      parseCiArgs(args.slice(0, -1).concat('0'), () => true),
    ).toThrow('--timeout must be a positive');
    expect(() => parseCiArgs(args.slice(0, -2), () => true)).toThrow(
      '--timeout is required',
    );
  });
});

describe('parseCiArgs app-version', () => {
  it('takes no option', () => {
    expect(parseCiArgs(['app-version'], () => true)).toEqual({
      command: 'app-version',
    });
    expect(() =>
      parseCiArgs(['app-version', '--env', 'staging'], () => true),
    ).toThrow(/Unknown option: --env/);
  });
});
