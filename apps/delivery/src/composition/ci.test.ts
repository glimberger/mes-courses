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
