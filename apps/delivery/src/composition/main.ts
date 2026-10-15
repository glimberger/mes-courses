import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { createFileDiskSpace } from '../adapters/filesystem/disk-space';
import { createFileFdroidSite } from '../adapters/filesystem/fdroid-site';
import { createFilePortOverride } from '../adapters/filesystem/port-override';
import { createFileReleaseStore } from '../adapters/filesystem/release-store';
import { createFileAgentLock } from '../adapters/filesystem/agent-lock';
import { createFileStateStore } from '../adapters/filesystem/state-store';
import { createGithubChannelSource } from '../adapters/github/channel-source';
import { createHttpHealthProbe } from '../adapters/http-health/health-probe';
import { createCommandRunner } from '../adapters/process/command-runner';
import { createSqliteFileSnapshots } from '../adapters/sqlite-files/database-snapshots';
import { createSshVerifier } from '../adapters/ssh-signature/ssh-signature';
import { createConsoleReporter } from '../adapters/error-reporting/console-reporter';
import {
  createSentryClient,
  createSentryReporter,
  type FlushableReporter,
} from '../adapters/error-reporting/sentry-reporter';
import { createSystemdServiceManager } from '../adapters/systemd/service-manager';
import { createSystemClock } from '../adapters/system/clock';
import { runExclusively } from '../application/run-exclusively';
import { deployFile } from '../application/deploy-file';
import { forgetFailure } from '../application/forget-failure';
import { showStatus } from '../application/show-status';
import { runAgent, type RunResult } from '../application/run-agent';
import type { Environment } from '../domain/manifest';

export type AgentCommand =
  | { command: 'run'; only?: Environment }
  | { command: 'status' }
  | { command: 'forget-failure'; environment: Environment; sha: string }
  | { command: 'deploy-file'; environment: Environment; file: string };

const environmentOf = (value: string | undefined, option: string) => {
  if (value !== 'staging' && value !== 'production') {
    throw new Error(`${option} must be staging or production, got ${value}`);
  }
  return value;
};

/** Parses the agent's command line (contracts/pi-layout.md, "Agent command line"). */
export const parseAgentArgs = (argv: string[]): AgentCommand => {
  const [command, ...rest] = argv;
  if (command === 'forget-failure' || command === 'deploy-file') {
    if (rest.length !== 2) {
      throw new Error(
        command === 'forget-failure'
          ? 'Usage: forget-failure <env> <sha>'
          : 'Usage: deploy-file <env> <server tarball>',
      );
    }
    const environment = environmentOf(rest[0], '<env>');
    const argument = rest[1] as string;
    return command === 'forget-failure'
      ? { command, environment, sha: argument }
      : { command, environment, file: argument };
  }
  if (command === 'status') {
    if (rest.length !== 0) throw new Error('Usage: status');
    return { command };
  }
  if (command !== 'run') {
    throw new Error(
      `Unknown command: ${command ?? '(none)'}. Use run, status, forget-failure or deploy-file.`,
    );
  }
  let only: Environment | undefined;
  for (let i = 0; i < rest.length; i += 2) {
    const option = rest[i];
    if (option !== '--only') throw new Error(`Unknown option: ${option}`);
    const value = rest[i + 1];
    if (value === undefined) throw new Error('--only needs a value');
    only = environmentOf(value, '--only');
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

const sha256Of = async (file: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');

const run = async (args: AgentCommand): Promise<number> => {
  const runner = createCommandRunner();
  const dsn = process.env.SENTRY_DSN;
  const reporter: FlushableReporter = dsn
    ? createSentryReporter(createSentryClient(dsn))
    : { ...createConsoleReporter(), flush: async () => undefined };
  const stateStore = createFileStateStore(PATHS.state);

  if (args.command === 'status') {
    console.log(
      await showStatus({ stateStore, health: createHttpHealthProbe() }),
    );
    return 0;
  }

  if (args.command === 'forget-failure') {
    const forgotten = await forgetFailure(
      { stateStore },
      args.environment,
      args.sha,
    );
    if (!forgotten) console.error(`${args.sha} is not a failed commit`);
    return forgotten ? 0 : 1;
  }

  const lock = createFileAgentLock(join(PATHS.state, 'agent.lock'));
  const exclusive = await runExclusively(lock, async () => {
    const { version } = JSON.parse(
      await readFile(resolve(__dirname, '../../package.json'), 'utf8'),
    ) as { version: string };
    const downloadDir = await mkdtemp(join(PATHS.state, 'download-'));
    const shared = {
      releases: createFileReleaseStore(PATHS.releases, runner),
      service: createSystemdServiceManager(runner),
      ports: createFilePortOverride(PATHS.run),
      health: createHttpHealthProbe(),
      snapshots: createSqliteFileSnapshots(PATHS.data),
      disk: createFileDiskSpace(PATHS.releases, PATHS.data),
      stateStore,
      reporter,
      downloadDir,
    };
    try {
      if (args.command === 'deploy-file') {
        const outcome = await deployFile(
          { ...shared, hashFile: sha256Of },
          args.environment,
          resolve(args.file),
        );
        console.error(`deploy-file ${outcome.kind}`);
        return outcome.kind === 'succeeded' ? 0 : 1;
      }
      const result = await runAgent(
        {
          ...shared,
          source: createGithubChannelSource({
            repository: required('GITHUB_REPOSITORY'),
            token: required('GITHUB_TOKEN'),
          }),
          verifier: createSshVerifier(PATHS.allowedSigners),
          site: createFileFdroidSite(PATHS.fdroid),
          clock: createSystemClock(),
          agentVersion: version,
        },
        args.only === undefined ? {} : { only: args.only },
      );
      return exitCodeOf(result);
    } finally {
      await rm(downloadDir, { recursive: true, force: true });
      await reporter.flush();
    }
  });
  if (exclusive.busy) {
    // A timer pass that finds a manual deployment running just waits for the next tick.
    console.error('Another agent operation is running; nothing done');
    return args.command === 'deploy-file' ? 1 : 0;
  }
  return exclusive.value;
};

if (require.main === module) {
  (async () => {
    process.exitCode = await run(parseAgentArgs(process.argv.slice(2)));
  })().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
}
