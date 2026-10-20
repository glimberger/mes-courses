import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CommandRunner } from '../../application/ports/command-runner';
import { createCommandRunner } from '../process/command-runner';
import { createGitReleaseRepository } from './release-repository';

const CONFIG = (version: string) =>
  `export default {\n  name: 'app',\n  version: '${version}',\n};\n`;

let dir: string;
let work: string;
let origin: string;

// A Git hook (pre-push) exports GIT_DIR and friends. They would point every git call below at
// the real repository instead of the temporary one, so they are dropped from the environment of
// every git process the test starts.
const gitEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() }).trim();

// The production runner inherits the real environment, so `env -u` drops the GIT_* variables.
const runnerWithoutGitEnv = (): CommandRunner => {
  const real = createCommandRunner();
  const unset = Object.keys(process.env)
    .filter((key) => key.startsWith('GIT_'))
    .flatMap((key) => ['-u', key]);
  return {
    run: (command, args, options) =>
      real.run('env', [...unset, command, ...args], options),
  };
};

const commitVersion = (version: string, message: string) => {
  writeFileSync(join(work, 'apps/mobile/app.config.ts'), CONFIG(version));
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', message);
  return git(work, 'rev-parse', 'HEAD');
};

const repo = () => createGitReleaseRepository(runnerWithoutGitEnv(), work);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-release-repo-'));
  origin = join(dir, 'origin.git');
  work = join(dir, 'work');
  mkdirSync(origin);
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  mkdirSync(join(work, 'apps/mobile'), { recursive: true });
  git(work, 'init', '-q', '-b', 'main');
  git(work, 'config', 'user.email', 'dev@example.com');
  git(work, 'config', 'user.name', 'Dev');
  git(work, 'config', 'commit.gpgsign', 'false');
  git(work, 'config', 'tag.gpgsign', 'false');
  git(work, 'remote', 'add', 'origin', origin);
  commitVersion('1.2.0', 'chore: initial');
  git(work, 'push', '-q', '-u', 'origin', 'main');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('git release repository', () => {
  it('reports the current branch and whether the tree is clean', async () => {
    expect(await repo().currentBranch()).toBe('main');
    expect(await repo().isClean()).toBe(true);
    writeFileSync(join(work, 'untracked.txt'), 'x');
    expect(await repo().isClean()).toBe(false);
  });

  it('tells whether the local main is origin/main', async () => {
    await repo().fetch();
    expect(await repo().isUpToDate()).toBe(true);
    commitVersion('1.2.1', 'chore: local only');
    expect(await repo().isUpToDate()).toBe(false);
  });

  it('reads the app version at a ref', async () => {
    expect(await repo().appVersionAt('origin/main')).toBe('1.2.0');
    commitVersion('1.3.0', 'chore: local bump');
    expect(await repo().appVersionAt('HEAD')).toBe('1.3.0');
    expect(await repo().appVersionAt('origin/main')).toBe('1.2.0');
  });

  it('commits the bump on chore/release-X.Y.Z, pushes it and returns to main', async () => {
    await repo().commitBump('1.3.0', 'chore/release-1.3.0');
    expect(git(work, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git(work, 'branch', '--list', 'chore/release-1.3.0')).toBe('');
    expect(readFileSync(join(work, 'apps/mobile/app.config.ts'), 'utf8')).toBe(
      CONFIG('1.2.0'),
    );
    expect(
      git(origin, 'show', 'chore/release-1.3.0:apps/mobile/app.config.ts'),
    ).toBe(CONFIG('1.3.0').trim());
    expect(git(origin, 'log', '-1', '--format=%s', 'chore/release-1.3.0')).toBe(
      'chore(release): bump the app version to 1.3.0',
    );
    expect(git(origin, 'rev-list', '--count', 'chore/release-1.3.0')).toBe('2');
  });

  it('does nothing more when the bump branch is already on the remote', async () => {
    await repo().commitBump('1.3.0', 'chore/release-1.3.0');
    const pushed = git(origin, 'rev-parse', 'chore/release-1.3.0');
    await repo().commitBump('1.3.0', 'chore/release-1.3.0');
    expect(git(origin, 'rev-parse', 'chore/release-1.3.0')).toBe(pushed);
    expect(git(work, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  it('leaves a clean checkout on main when the commit hook fails', async () => {
    const hook = join(work, '.git/hooks/pre-commit');
    writeFileSync(hook, '#!/bin/sh\necho refused >&2\nexit 1\n', {
      mode: 0o755,
    });
    await expect(
      repo().commitBump('1.3.0', 'chore/release-1.3.0'),
    ).rejects.toThrow(/commit failed/);
    expect(git(work, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git(work, 'status', '--porcelain')).toBe('');
    expect(git(work, 'branch', '--list', 'chore/release-1.3.0')).toBe('');
    expect(await repo().isClean()).toBe(true);
  });

  it('gives the pushes the time the pre-push hook needs', async () => {
    const real = runnerWithoutGitEnv();
    const limits: Record<string, number | undefined> = {};
    const spy: CommandRunner = {
      run: (command, args, options) => {
        const git = args.indexOf('git');
        const name = args[git + 1] ?? '';
        limits[name] = options?.timeoutMs;
        return real.run(command, args, options);
      },
    };
    const subject = createGitReleaseRepository(spy, work);
    await subject.commitBump('1.3.0', 'chore/release-1.3.0');
    expect(limits.push).toBeGreaterThanOrEqual(5 * 60_000);
    expect(limits.status ?? 0).toBeLessThan(5 * 60_000);
  });

  it('reports whether a branch is on the remote', async () => {
    expect(await repo().remoteBranchExists('chore/release-1.3.0')).toBe(false);
    await repo().commitBump('1.3.0', 'chore/release-1.3.0');
    expect(await repo().remoteBranchExists('chore/release-1.3.0')).toBe(true);
  });

  it('creates and pushes an annotated tag, and does it again without error', async () => {
    const sha = git(work, 'rev-parse', 'HEAD');
    expect(await repo().tagCommit('v1.2.0')).toEqual({
      local: null,
      remote: null,
    });
    await repo().createTag('v1.2.0', sha);
    await repo().createTag('v1.2.0', sha);
    await repo().pushTag('v1.2.0');
    await repo().pushTag('v1.2.0');
    expect(git(work, 'cat-file', '-t', 'v1.2.0')).toBe('tag');
    expect(await repo().tagCommit('v1.2.0')).toEqual({
      local: sha,
      remote: sha,
    });
  });

  it('refuses to move a tag that points elsewhere', async () => {
    const first = git(work, 'rev-parse', 'HEAD');
    const second = commitVersion('1.2.1', 'chore: next');
    await repo().createTag('v1.2.0', first);
    await expect(repo().createTag('v1.2.0', second)).rejects.toThrow(/v1.2.0/);
  });

  it('finds the commit of origin/main that set a version', async () => {
    const bump = commitVersion('1.3.0', 'chore(release): bump to 1.3.0');
    writeFileSync(join(work, 'other.txt'), 'x');
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'feat: other');
    commitVersion('1.4.0', 'chore(release): bump to 1.4.0');
    git(work, 'push', '-q', 'origin', 'main');
    await repo().fetch();
    expect(await repo().releaseCommit('1.3.0')).toBe(bump);
    expect(await repo().releaseCommit('9.9.9')).toBeNull();
  });

  it('finds the newest commit that set the version after a revert and a re-merge', async () => {
    commitVersion('1.3.0', 'chore(release): bump to 1.3.0');
    commitVersion('1.2.0', 'revert: bump to 1.3.0');
    const again = commitVersion('1.3.0', 'chore(release): bump to 1.3.0 again');
    git(work, 'push', '-q', 'origin', 'main');
    await repo().fetch();
    expect(await repo().releaseCommit('1.3.0')).toBe(again);
  });
});
