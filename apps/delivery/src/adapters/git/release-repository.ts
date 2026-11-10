import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { CommandRunner } from '../../application/ports/command-runner';
import type { ReleaseRepository } from '../../application/ports/release-repository';
import {
  serializeData,
  upsertMarkdown,
  upsertSection,
  type ChangelogSection,
} from '../../domain/changelog';
import { readAppVersion, setAppVersion } from '../../domain/release-plan';

const GIT_LIMIT_MS = 60_000;
// A push runs the pre-push hook of the repository (whole-repo typecheck, tests, architecture).
const PUSH_LIMIT_MS = 15 * 60_000;
const CONFIG_PATH = 'apps/mobile/app.config.ts';
const CHANGELOG_PATH = 'CHANGELOG.md';
const DATA_PATH = 'apps/mobile/src/changelog/changelog.json';

/** The text of `file`, or an empty string when it does not exist yet (first release). */
const readOrEmpty = async (file: string): Promise<string> => {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
};

const parseData = (text: string): ChangelogSection[] => {
  if (text.trim() === '') return [];
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data))
    throw new Error(`${DATA_PATH} is not an array of sections`);
  return data as ChangelogSection[];
};

/** Writes `section` into both changelog files of the tree at `cwd`. */
const writeChangelog = async (cwd: string, section: ChangelogSection) => {
  const markdown = join(cwd, CHANGELOG_PATH);
  const data = join(cwd, DATA_PATH);
  const sections = upsertSection(parseData(await readOrEmpty(data)), section);
  await writeFile(
    markdown,
    upsertMarkdown(await readOrEmpty(markdown), section),
  );
  await mkdir(dirname(data), { recursive: true });
  await writeFile(data, serializeData(sections));
};

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The git side of a release, done in the checked-out repository at `cwd`. */
export const createGitReleaseRepository = (
  runner: CommandRunner,
  cwd: string,
): ReleaseRepository => {
  const run = (args: string[]) =>
    runner.run('git', args, {
      cwd,
      timeoutMs: args[0] === 'push' ? PUSH_LIMIT_MS : GIT_LIMIT_MS,
    });

  const git = async (...args: string[]): Promise<string> => {
    const result = await run(args);
    if (result.exitCode !== 0) {
      throw new Error(
        `git ${args[0]} failed (${result.exitCode}): ${result.stderr.trim()}`,
      );
    }
    return result.stdout.trim();
  };

  const appVersionAt = async (ref: string) =>
    readAppVersion(await git('show', `${ref}:${CONFIG_PATH}`));

  const localTag = async (tag: string): Promise<string | null> => {
    const result = await run([
      'rev-parse',
      '-q',
      '--verify',
      `refs/tags/${tag}^{commit}`,
    ]);
    return result.exitCode === 0 ? result.stdout.trim() : null;
  };

  const remoteTag = async (tag: string): Promise<string | null> => {
    const out = await git(
      'ls-remote',
      'origin',
      `refs/tags/${tag}`,
      `refs/tags/${tag}^{}`,
    );
    let direct: string | null = null;
    for (const line of out.split('\n').filter(Boolean)) {
      const [sha = '', ref] = line.split(/\s+/);
      if (ref === `refs/tags/${tag}^{}`) return sha;
      direct = sha;
    }
    return direct;
  };

  const remoteBranchExists = async (branch: string) =>
    (await git('ls-remote', '--heads', 'origin', branch)) !== '';

  return {
    currentBranch: () => git('rev-parse', '--abbrev-ref', 'HEAD'),

    async isClean() {
      return (await git('status', '--porcelain')) === '';
    },

    async fetch() {
      await git('fetch', 'origin');
    },

    async isUpToDate() {
      return (
        (await git('rev-parse', 'main')) ===
        (await git('rev-parse', 'origin/main'))
      );
    },

    appVersionAt,

    remoteBranchExists,

    async tagCommit(tag) {
      return { local: await localTag(tag), remote: await remoteTag(tag) };
    },

    async commitBump(version, branch, section) {
      // Already pushed by an earlier run: nothing to redo.
      if (await remoteBranchExists(branch)) return;

      await git('switch', '-C', branch, 'origin/main');
      try {
        const file = join(cwd, CONFIG_PATH);
        await writeFile(
          file,
          setAppVersion(await readFile(file, 'utf8'), version),
        );
        await writeChangelog(cwd, section);
        await git('add', CONFIG_PATH, CHANGELOG_PATH, DATA_PATH);
        await git(
          'commit',
          '-m',
          `chore(release): bump the app version to ${version}`,
        );
        await git('push', '--set-upstream', 'origin', branch);
      } finally {
        // A failed hook or push leaves the edits in the tree: drop them so that main stays clean.
        await run(['reset', '--hard', 'HEAD']);
        // A changelog file new to this branch stays untracked when it failed before `git add`.
        await run(['clean', '-f', '--', CHANGELOG_PATH, DATA_PATH]);
        const back = await run(['switch', 'main']);
        if (back.exitCode === 0) await run(['branch', '-D', branch]);
      }
    },

    async createTag(tag, sha) {
      const existing = await localTag(tag);
      if (existing === sha) return;
      if (existing !== null) {
        throw new Error(`The tag ${tag} already points to ${existing}`);
      }
      await git('tag', '-a', tag, '-m', `Release ${tag}`, sha);
    },

    async pushTag(tag) {
      await git('push', 'origin', `refs/tags/${tag}`);
    },

    async releaseCommit(version) {
      const out = await git(
        'log',
        'origin/main',
        '--format=%H',
        `-Gversion: '${escapeRegExp(version)}'`,
        '--',
        CONFIG_PATH,
      );
      // -G also matches the commits that move away from the version: keep the newest one that set
      // it, so that a revert followed by a new merge picks the commit on main today.
      for (const sha of out.split('\n').filter(Boolean)) {
        if ((await appVersionAt(sha)) === version) return sha;
      }
      return null;
    },
  };
};
