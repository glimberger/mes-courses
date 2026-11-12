import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  AgentHost,
  AgentRelease,
} from '../../application/ports/agent-update';
import type { CommandRunner } from '../../application/ports/command-runner';

const QUICK_LIMIT_MS = 60_000;
const DOWNLOAD_LIMIT_MS = 10 * 60_000;
const BUILD_LIMIT_MS = 30 * 60_000;

/** The exit code the remote script uses for "no" (ssh itself uses 255, a crash 1). */
const NO = 10;

/** The script that runs on the Pi, next to this file. */
export const REMOTE_SCRIPT = join(__dirname, 'agent-host.sh');

/**
 * The agent's installation on a Pi reached with `ssh <host>`. Every operation sends the script
 * `agent-host.sh` on the standard input of `sudo -n sh -s -- <operation> <arguments>`: the
 * arguments are a version and a number, and the GitHub token is read on the Pi from its env file,
 * so no secret appears on any command line.
 */
export const createSshAgentHost = (
  runner: CommandRunner,
  host: string,
  script: string = readFileSync(REMOTE_SCRIPT, 'utf8'),
): AgentHost => {
  const call = async (operation: string, args: string[], timeoutMs: number) => {
    const result = await runner.run(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        host,
        'sudo',
        '-n',
        'sh',
        '-s',
        '--',
        operation,
        ...args,
      ],
      { input: script, timeoutMs },
    );
    if (result.timedOut) {
      throw new Error(`\`${operation}\` on ${host} exceeded its time limit`);
    }
    return result;
  };

  const succeed = async (
    operation: string,
    args: string[],
    timeoutMs: number,
  ): Promise<string> => {
    const result = await call(operation, args, timeoutMs);
    if (result.exitCode !== 0) {
      throw new Error(
        `\`${operation}\` on ${host} failed (${result.exitCode}): ${result.stderr.trim()}`,
      );
    }
    return result.stdout;
  };

  return {
    currentVersion: async () =>
      (await succeed('current', [], QUICK_LIMIT_MS)).trim() || null,
    isReady: async (version) => {
      const result = await call('ready', [version], QUICK_LIMIT_MS);
      if (result.exitCode === 0) return true;
      if (result.exitCode === NO) return false;
      throw new Error(
        `\`ready\` on ${host} failed (${result.exitCode}): ${result.stderr.trim()}`,
      );
    },
    install: async (release: AgentRelease) => {
      await succeed(
        'install',
        [release.agentVersion, String(release.assetId)],
        DOWNLOAD_LIMIT_MS,
      );
    },
    buildRuntime: async (version) => {
      await succeed('build', [version], BUILD_LIMIT_MS);
    },
    activate: async (version) => {
      await succeed('activate', [version], QUICK_LIMIT_MS);
    },
    status: async () => (await succeed('status', [], QUICK_LIMIT_MS)).trim(),
  };
};
