import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CommandRunner } from '../../application/ports/command-runner';
import { ScriptedCommandRunner } from '../../application/testing/in-memory-doubles';
import { createCommandRunner } from '../process/command-runner';
import { createGitCliffGenerator } from './git-cliff-generator';

// The real configuration of the repository: these tests are the specification of cliff.toml.
const CONFIG = join(__dirname, '../../../../../cliff.toml');

let dir: string;

// A Git hook (pre-push) exports GIT_DIR and friends; they would point git and git-cliff at the
// real repository instead of the fixture, so they are dropped from every process started here.
const gitEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );

const git = (...args: string[]) =>
  execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...gitEnv(),
      GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
    },
  }).trim();

const commit = (message: string) =>
  git('commit', '-q', '--allow-empty', '-m', message);

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

const generator = (config = CONFIG) =>
  createGitCliffGenerator(runnerWithoutGitEnv(), dir, config);

const generate = () => generator().generate('1.1.0', '2026-11-10');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-cliff-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'dev@example.com');
  git('config', 'user.name', 'Dev');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('git-cliff changelog generator', () => {
  describe('after a release tag', () => {
    beforeEach(() => {
      commit('feat: already released (#1)');
      git('tag', '-a', 'v1.0.0', '-m', 'Release v1.0.0');
      git('tag', 'channel-staging');
    });

    it('lists feat, fix and perf commits under their groups, newest last as in the history', async () => {
      commit('feat: add dark mode (#10)');
      commit('fix: keep the quantity on sync');
      commit('perf: faster list (#11)');
      commit('feat(app): a scoped feature (#14)');
      expect(await generate()).toEqual({
        version: '1.1.0',
        date: '2026-11-10',
        features: [
          { text: 'add dark mode', pr: 10 },
          { text: 'a scoped feature', pr: 14 },
        ],
        fixes: [{ text: 'keep the quantity on sync', pr: null }],
        performances: [{ text: 'faster list', pr: 11 }],
        breaking: [],
      });
    });

    it('drops the ci, e2e, test and delivery scopes, even for a feat or a fix', async () => {
      commit('fix(e2e): a flaky journey');
      commit('fix(ci): the cache key');
      commit('fix(test): a fixture');
      commit('feat(delivery): a release step');
      commit('feat(ci): a new job');
      expect(await generate()).toEqual({
        version: '1.1.0',
        date: '2026-11-10',
        features: [],
        fixes: [],
        performances: [],
        breaking: [],
      });
    });

    it('drops the chore, docs, ci, test, refactor, build and style types', async () => {
      for (const type of [
        'chore',
        'docs',
        'ci',
        'test',
        'refactor',
        'build',
        'style',
      ])
        commit(`${type}: some ${type} work`);
      commit('feat: the only entry');
      expect((await generate()).features).toEqual([
        { text: 'the only entry', pr: null },
      ]);
      expect((await generate()).fixes).toEqual([]);
    });

    it('keeps a breaking change of any type or scope, only under breaking', async () => {
      commit('chore!: drop node 22 (#12)');
      commit('refactor: new storage\n\nBREAKING CHANGE: the old file is gone');
      commit('feat(ci)!: a breaking pipeline');
      commit('feat!: a breaking feature');
      const section = await generate();
      expect(section.breaking).toEqual([
        { text: 'drop node 22', pr: 12 },
        { text: 'new storage', pr: null },
        { text: 'a breaking pipeline', pr: null },
        { text: 'a breaking feature', pr: null },
      ]);
      expect(section.features).toEqual([]);
    });

    it('ignores a commit that is not a Conventional Commit without failing', async () => {
      commit('random message');
      commit('Merge branch something');
      commit('fix: a real fix');
      expect((await generate()).fixes).toEqual([
        { text: 'a real fix', pr: null },
      ]);
    });

    it('keeps markdown and JSON special characters of a subject as written', async () => {
      commit('fix: show `code`, "quotes", <b>, [x](y) and \\ as is (#13)');
      expect((await generate()).fixes).toEqual([
        { text: 'show `code`, "quotes", <b>, [x](y) and \\ as is', pr: 13 },
      ]);
    });

    it('gives an empty section when no commit is left after filtering', async () => {
      commit('docs: only docs');
      expect(await generate()).toEqual({
        version: '1.1.0',
        date: '2026-11-10',
        features: [],
        fixes: [],
        performances: [],
        breaking: [],
      });
    });

    it('ignores the channel tags, which are not release tags', async () => {
      commit('feat: before the channel tag');
      git('tag', '-f', 'channel-staging');
      git('tag', 'channel-production');
      commit('feat: after the channel tag');
      expect((await generate()).features).toEqual([
        { text: 'before the channel tag', pr: null },
        { text: 'after the channel tag', pr: null },
      ]);
    });
  });

  it('covers the whole history when there is no previous release tag', async () => {
    commit('feat: first feature (#2)');
    commit('fix: first fix');
    expect(await generate()).toEqual({
      version: '1.1.0',
      date: '2026-11-10',
      features: [{ text: 'first feature', pr: 2 }],
      fixes: [{ text: 'first fix', pr: null }],
      performances: [],
      breaking: [],
    });
  });

  it('fails with the reason when the configuration is wrong', async () => {
    commit('feat: something');
    const bad = join(dir, 'bad.toml');
    writeFileSync(bad, '[git\n');
    await expect(
      generator(bad).generate('1.1.0', '2026-11-10'),
    ).rejects.toThrow(/git-cliff failed \(1\):.*unclosed table/s);
  });

  it('fails with a clear message when git-cliff is not installed', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ exitCode: 127, stderr: 'spawn git-cliff ENOENT' });
    await expect(
      createGitCliffGenerator(runner, dir, CONFIG).generate(
        '1.1.0',
        '2026-11-10',
      ),
    ).rejects.toThrow(
      'git-cliff is not installed: run the release from the Nix dev shell (nix develop)',
    );
  });
});
