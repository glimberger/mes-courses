import { resolve } from 'node:path';
import { setTimeout as sleepFor } from 'node:timers/promises';

import { createGithubChannelSource } from '../adapters/github/channel-source';
import { createGh } from '../adapters/github/gh';
import { createGithubReleasePullRequests } from '../adapters/github/release-pull-requests';
import { createGithubReleaseRuns } from '../adapters/github/release-runs';
import { createGitReleaseRepository } from '../adapters/git/release-repository';
import { createCommandRunner } from '../adapters/process/command-runner';
import { createTerminalPrompter } from '../adapters/terminal/prompter';
import type { CommandRunner } from '../application/ports/command-runner';
import {
  runRelease,
  type ReleaseResult,
  type ReleaseRequest,
} from '../application/run-release';
import { parseTarget, type ReleaseTarget } from '../domain/release-plan';

export type ReleaseCommand = ReleaseRequest & { dryRun: boolean };

/** A malformed command line; the exit code is 2. */
export class UsageError extends Error {}

export const USAGE =
  'Usage: yarn release [major|minor|patch|X.Y.Z] [--yes|-y] [--dry-run]';

const TARGET = /^(major|minor|patch|\d+\.\d+\.\d+)$/;

/** Parses the command line of `yarn release` (contracts/cli.md). */
export const parseReleaseArgs = (
  argv: string[],
  { interactive = true }: { interactive?: boolean } = {},
): ReleaseCommand => {
  let assumeYes = false;
  let dryRun = false;
  let argument: string | undefined;
  for (const arg of argv) {
    if (arg === '--yes' || arg === '-y') assumeYes = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('-'))
      throw new UsageError(`Unknown option: ${arg}\n${USAGE}`);
    else if (argument !== undefined)
      throw new UsageError(
        `Give one target, got ${argument} and ${arg}\n${USAGE}`,
      );
    else if (!TARGET.test(arg))
      throw new UsageError(
        `${arg} is neither major, minor, patch nor a version X.Y.Z\n${USAGE}`,
      );
    else argument = arg;
  }
  if (argument === undefined && !interactive)
    throw new UsageError(
      `Give a bump type or a version: there is no terminal to ask on\n${USAGE}`,
    );
  const target: ReleaseTarget = parseTarget(argument);
  return { target, assumeYes, dryRun };
};

/** 0 for a release, an already released version or a declined release; 1 for a refusal or a stop. */
export const exitCodeOf = (result: ReleaseResult): 0 | 1 =>
  result.outcome === 'stopped' ? 1 : 0;

/**
 * The repository and the read token of the production channel: from the environment when set (CI),
 * else from the maintainer's `gh` session.
 */
export const deriveGithubAccess = async (
  runner: CommandRunner,
  cwd: string,
  env: Record<string, string | undefined> = {},
): Promise<{ repository: string; token: string }> => {
  const gh = async (args: string[]) =>
    (await createGh(runner, cwd)(args)).trim();
  return {
    repository:
      env.GITHUB_REPOSITORY ||
      (await gh([
        'repo',
        'view',
        '--json',
        'nameWithOwner',
        '--jq',
        '.nameWithOwner',
      ])),
    token: env.GITHUB_TOKEN || (await gh(['auth', 'token'])),
  };
};

const ROOT = resolve(__dirname, '../../../..');

const main = async (argv: string[]): Promise<number> => {
  const command = parseReleaseArgs(argv, {
    interactive: process.stdin.isTTY === true,
  });
  const runner = createCommandRunner();
  const { repository, token } = await deriveGithubAccess(
    runner,
    ROOT,
    process.env,
  );
  const sleep = (ms: number) => sleepFor(ms);
  const result = await runRelease(
    {
      repository: createGitReleaseRepository(runner, ROOT),
      pullRequests: createGithubReleasePullRequests(runner, ROOT),
      runs: createGithubReleaseRuns(runner, ROOT, sleep),
      source: createGithubChannelSource({ repository, token }),
      prompter: createTerminalPrompter(process.stdin, process.stdout),
      output: { line: (text) => console.log(text) },
      sleep,
    },
    command,
  );
  if (result.outcome === 'stopped') console.error(result.message);
  return exitCodeOf(result);
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error((error as Error).message);
      process.exit(error instanceof UsageError ? 2 : 1);
    });
}
