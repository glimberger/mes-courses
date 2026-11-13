import { resolve } from 'node:path';

import { createGithubAgentReleases } from '../adapters/github/agent-releases';
import { createCommandRunner } from '../adapters/process/command-runner';
import { createTerminalSecretPrompter } from '../adapters/terminal/secret-prompter';
import { createSshAgentHost } from '../adapters/ssh-host/agent-host';
import {
  updateAgent,
  type UpdateAgentResult,
} from '../application/update-agent';

export type AgentUpdateCommand = {
  /** The release `X.Y.Z`; the latest when absent. */
  version?: string | undefined;
  dryRun: boolean;
  /** The ssh destination of the Pi. */
  host: string;
};

/** A malformed command line; the exit code is 2. */
export class UsageError extends Error {}

export const DEFAULT_HOST = 'agent-pi';

export const USAGE =
  'Usage: pnpm agent:update [--version X.Y.Z] [--dry-run] [--host <ssh destination>]';

/** Parses the command line of `pnpm agent:update`. */
export const parseAgentUpdateArgs = (
  argv: string[],
  env: Record<string, string | undefined> = {},
): AgentUpdateCommand => {
  let version: string | undefined;
  let dryRun = false;
  let host = env.AGENT_UPDATE_HOST || DEFAULT_HOST;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--version' || arg === '--host') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-'))
        throw new UsageError(`${arg} needs a value\n${USAGE}`);
      i += 1;
      if (arg === '--host') host = value;
      else version = value;
    } else throw new UsageError(`Unexpected argument: ${arg}\n${USAGE}`);
  }
  if (version !== undefined) {
    version = version.replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+$/.test(version))
      throw new UsageError(`${version} is not a version X.Y.Z\n${USAGE}`);
  }
  if (host.startsWith('-') || /\s/.test(host))
    throw new UsageError(`${host} is not an ssh destination\n${USAGE}`);
  return { version, dryRun, host };
};

/** 0 for an install, a no-op or a dry run; 1 for a stop. */
export const exitCodeOf = (result: UpdateAgentResult): 0 | 1 =>
  result.outcome === 'stopped' ? 1 : 0;

/** The message refusing to run as root, null otherwise: as root, ssh uses root's own keys and known_hosts. */
export const refuseRoot = (uid: number | undefined): string | null =>
  uid === 0
    ? "Do not run `pnpm agent:update` as root or with sudo: run it without sudo (as root, ssh uses root's keys and known_hosts, not yours). It asks for the Pi's sudo password itself when needed."
    : null;

const ROOT = resolve(__dirname, '../../../..');

const main = async (argv: string[]): Promise<number> => {
  const refusal = refuseRoot(process.getuid?.());
  if (refusal !== null) {
    console.error(refusal);
    return 1;
  }
  const command = parseAgentUpdateArgs(argv, process.env);
  const secrets = createTerminalSecretPrompter(process.stdin, process.stderr);
  const runner = createCommandRunner();
  const result = await updateAgent(
    {
      releases: createGithubAgentReleases(runner, ROOT),
      host: createSshAgentHost(runner, command.host, undefined, () =>
        secrets.askSecret(`sudo password for ${command.host}: `),
      ),
      output: { line: (text) => console.log(text) },
    },
    { version: command.version, dryRun: command.dryRun },
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
