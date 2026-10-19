import { ScriptedCommandRunner } from '../application/testing/in-memory-doubles';
import {
  deriveGithubAccess,
  exitCodeOf,
  parseReleaseArgs,
  UsageError,
} from './release';

describe('parseReleaseArgs', () => {
  it('reads a bump type', () => {
    expect(parseReleaseArgs(['minor'])).toEqual({
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: false,
      dryRun: false,
    });
  });

  it('reads an explicit version', () => {
    expect(parseReleaseArgs(['1.3.0']).target).toEqual({
      kind: 'version',
      version: '1.3.0',
    });
  });

  it('asks when there is no target', () => {
    expect(parseReleaseArgs([]).target).toEqual({ kind: 'ask' });
  });

  it('reads --yes, -y and --dry-run in any position', () => {
    expect(parseReleaseArgs(['--yes', 'patch', '--dry-run'])).toMatchObject({
      target: { kind: 'bump', bump: 'patch' },
      assumeYes: true,
      dryRun: true,
    });
    expect(parseReleaseArgs(['-y']).assumeYes).toBe(true);
  });

  it('rejects an unknown option', () => {
    expect(() => parseReleaseArgs(['--force'])).toThrow(UsageError);
    expect(() => parseReleaseArgs(['--force'])).toThrow(/--force/);
  });

  it('rejects two targets', () => {
    expect(() => parseReleaseArgs(['minor', 'patch'])).toThrow(UsageError);
  });

  it('rejects an argument that is neither a bump nor a version', () => {
    expect(() => parseReleaseArgs(['banana'])).toThrow(UsageError);
    expect(() => parseReleaseArgs(['1.2'])).toThrow(UsageError);
  });
});

describe('exitCodeOf', () => {
  it('is 0 for released and declined, 1 for stopped', () => {
    expect(exitCodeOf({ outcome: 'released' })).toBe(0);
    expect(exitCodeOf({ outcome: 'declined' })).toBe(0);
    expect(exitCodeOf({ outcome: 'stopped', message: 'x' })).toBe(1);
  });
});

describe('deriveGithubAccess', () => {
  it('reads the repository and the token from gh', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ stdout: 'owner/repo\n' }, { stdout: 'ghs_token\n' });
    await expect(deriveGithubAccess(runner, '/repo')).resolves.toEqual({
      repository: 'owner/repo',
      token: 'ghs_token',
    });
  });

  it('fails clearly when gh cannot tell', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ exitCode: 1, stderr: 'not logged in' });
    await expect(deriveGithubAccess(runner, '/repo')).rejects.toThrow(
      /not logged in/,
    );
  });

  it('prefers GITHUB_REPOSITORY and GITHUB_TOKEN when set', async () => {
    const runner = new ScriptedCommandRunner();
    await expect(
      deriveGithubAccess(runner, '/repo', {
        GITHUB_REPOSITORY: 'a/b',
        GITHUB_TOKEN: 't',
      }),
    ).resolves.toEqual({ repository: 'a/b', token: 't' });
  });
});
