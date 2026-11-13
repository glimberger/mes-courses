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

/** What sudo says on stderr when it was given no password or a wrong one. */
const WRONG_PASSWORD =
  /incorrect password|Sorry, try again|no password was provided/;

/**
 * The agent's installation on a Pi reached with `ssh <host>`. Every operation sends the script
 * `agent-host.sh` on the standard input of `sudo -n sh -s -- <operation> <arguments>` (passwordless
 * sudo, found by a first `sudo -n true`) or, when the login needs a password, of
 * `sudo -S -p '' sh -s -- ...` with the password as the first line of the standard input. The
 * password comes from `askPassword`, once per run, stays in memory, and is on no command line, in
 * no error. The arguments are a version and a number, and the GitHub token is read on the Pi from
 * its env file, so no secret appears on any command line.
 */
export const createSshAgentHost = (
  runner: CommandRunner,
  host: string,
  script: string = readFileSync(REMOTE_SCRIPT, 'utf8'),
  askPassword?: () => Promise<string>,
): AgentHost => {
  /** The password, or null for passwordless sudo; decided once, by the first call. */
  let password: Promise<string | null> | undefined;

  const detectSudo = async (): Promise<string | null> => {
    const check = await runner.run(
      'ssh',
      ['-o', 'BatchMode=yes', host, 'sudo', '-n', 'true'],
      { timeoutMs: QUICK_LIMIT_MS },
    );
    if (check.timedOut) {
      throw new Error(`\`sudo -n true\` on ${host} exceeded its time limit`);
    }
    if (check.exitCode === 0) return null;
    if (check.exitCode === 1 && /a password is required/.test(check.stderr)) {
      if (!askPassword) {
        throw new Error(`the sudo password for ${host} is required`);
      }
      return askPassword();
    }
    throw new Error(
      `\`sudo -n true\` on ${host} failed (${check.exitCode}): ${check.stderr.trim()}`,
    );
  };

  const call = async (operation: string, args: string[], timeoutMs: number) => {
    password ??= detectSudo();
    const secret = await password;
    // -k makes sudo always read the password, so the first stdin line is never run by sh.
    const sudo = secret === null ? ['-n'] : ['-k', '-S', '-p', "''"];
    const result = await runner.run(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        host,
        'sudo',
        ...sudo,
        'sh',
        '-s',
        '--',
        operation,
        ...args,
      ],
      {
        input: secret === null ? script : `${secret}\n${script}`,
        timeoutMs,
      },
    );
    if (result.timedOut) {
      throw new Error(`\`${operation}\` on ${host} exceeded its time limit`);
    }
    if (secret !== null && result.exitCode !== 0) {
      if (WRONG_PASSWORD.test(result.stderr)) {
        throw new Error(`the sudo password for ${host} is incorrect`);
      }
      // sh may echo the password it ran as a command ("sh: <password>: not found").
      if (secret === '') return result;
      return { ...result, stderr: result.stderr.split(secret).join('***') };
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
