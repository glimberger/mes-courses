import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { createFileFdroidSite } from '../adapters/filesystem/fdroid-site';
import { createFilePortOverride } from '../adapters/filesystem/port-override';
import { createFileReleaseStore } from '../adapters/filesystem/release-store';
import { createFileStateStore } from '../adapters/filesystem/state-store';
import { createGithubChannelSource } from '../adapters/github/channel-source';
import { createHttpHealthProbe } from '../adapters/http-health/health-probe';
import { createCommandRunner } from '../adapters/process/command-runner';
import { createSqliteFileSnapshots } from '../adapters/sqlite-files/database-snapshots';
import { createSshVerifier } from '../adapters/ssh-signature/ssh-signature';
import { createConsoleReporter } from '../adapters/error-reporting/console-reporter';
import { createSystemdServiceManager } from '../adapters/systemd/service-manager';
import { createSystemClock } from '../adapters/system/clock';
import { runAgent, type RunResult } from '../application/run-agent';
import type { Environment } from '../domain/manifest';

export type AgentCommand = { command: 'run'; only?: Environment };

/** Parses the agent's command line (contracts/pi-layout.md, "Agent command line"). */
export const parseAgentArgs = (argv: string[]): AgentCommand => {
  const [command, ...rest] = argv;
  if (command !== 'run') {
    throw new Error(`Unknown command: ${command ?? '(none)'}. Use run.`);
  }
  let only: Environment | undefined;
  for (let i = 0; i < rest.length; i += 2) {
    const option = rest[i];
    if (option !== '--only') throw new Error(`Unknown option: ${option}`);
    const value = rest[i + 1];
    if (value === undefined) throw new Error('--only needs a value');
    if (value !== 'staging' && value !== 'production') {
      throw new Error(`--only must be staging or production, got ${value}`);
    }
    only = value;
  }
  return only === undefined ? { command } : { command, only };
};

/** `0` unless an instance was left degraded. */
export const exitCodeOf = (result: RunResult): number =>
  result.degraded ? 1 : 0;

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

/** Where the agent works on the Pi (contracts/pi-layout.md). */
const PATHS = {
  releases: '/opt/mes-courses',
  data: '/var/lib/mes-courses',
  state: '/var/lib/mes-courses-agent',
  run: '/run/mes-courses',
  fdroid: '/srv/fdroid',
  allowedSigners: '/etc/mes-courses/allowed_signers',
};

const run = async (args: AgentCommand): Promise<number> => {
  const runner = createCommandRunner();
  const reporter = createConsoleReporter();
  const { version } = JSON.parse(
    await readFile(resolve(__dirname, '../../package.json'), 'utf8'),
  ) as { version: string };
  const downloadDir = await mkdtemp(join(PATHS.state, 'download-'));
  try {
    const result = await runAgent(
      {
        source: createGithubChannelSource({
          repository: required('GITHUB_REPOSITORY'),
          token: required('GITHUB_TOKEN'),
        }),
        verifier: createSshVerifier(PATHS.allowedSigners),
        releases: createFileReleaseStore(PATHS.releases, runner),
        service: createSystemdServiceManager(runner),
        ports: createFilePortOverride(PATHS.run),
        health: createHttpHealthProbe(),
        snapshots: createSqliteFileSnapshots(PATHS.data),
        site: createFileFdroidSite(PATHS.fdroid),
        stateStore: createFileStateStore(PATHS.state),
        reporter,
        clock: createSystemClock(),
        downloadDir,
        agentVersion: version,
      },
      args.only === undefined ? {} : { only: args.only },
    );
    return exitCodeOf(result);
  } finally {
    await rm(downloadDir, { recursive: true, force: true });
  }
};

if (require.main === module) {
  (async () => {
    process.exitCode = await run(parseAgentArgs(process.argv.slice(2)));
  })().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
}
