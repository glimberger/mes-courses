import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { releaseGate } from '../application/release-gate';
import { writeManifest } from '../application/write-manifest';
import { createGithubChannelPublisher } from '../adapters/github/channel-publisher';
import { createGithubChannelSource } from '../adapters/github/channel-source';
import { createGithubRunHistory } from '../adapters/github/run-history';
import { createGitFacts } from '../adapters/git/git-facts';
import { waitForHealthyCommit } from '../adapters/http-health/health-probe';
import { createCommandRunner } from '../adapters/process/command-runner';
import { createSshSigner } from '../adapters/ssh-signature/ssh-signature';
import { createSystemClock } from '../adapters/system/clock';
import type { Environment } from '../domain/manifest';
import { readAppVersion } from '../domain/release-plan';
import { REQUIRED_WORKFLOWS } from '../domain/release-rules';

export type WriteManifestCommand = {
  command: 'write-manifest';
  environment: Environment;
  commit: string;
  server?: string | undefined;
  fdroid?: string | undefined;
  version?: string | undefined;
};

export type ReleaseGateCommand = {
  command: 'release-gate';
  tag: string;
  commit: string;
};

export type WaitHealthCommand = {
  command: 'wait-health';
  url: string;
  commit: string;
  timeoutSeconds: number;
};

/** Prints the app version of the checkout, the version both environments are named after. */
export type AppVersionCommand = { command: 'app-version' };

export type CiCommand =
  | WriteManifestCommand
  | ReleaseGateCommand
  | WaitHealthCommand
  | AppVersionCommand;

const OPTIONS = ['--env', '--commit', '--server', '--fdroid', '--version'];
const COMMANDS = 'write-manifest, release-gate, wait-health or app-version';

const readOptions = (
  rest: string[],
  allowed: string[],
): Map<string, string> => {
  const values = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const option = rest[i] as string;
    if (!allowed.includes(option)) throw new Error(`Unknown option: ${option}`);
    const value = rest[i + 1];
    if (value === undefined) throw new Error(`${option} needs a value`);
    values.set(option, value);
  }
  return values;
};

const requireCommit = (values: Map<string, string>): string => {
  const commit = values.get('--commit');
  if (commit === undefined) throw new Error('--commit is required');
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error('--commit must be 40 lowercase hex characters');
  }
  return commit;
};

const parseReleaseGateArgs = (rest: string[]): ReleaseGateCommand => {
  const values = readOptions(rest, ['--tag', '--commit']);
  const tag = values.get('--tag');
  if (tag === undefined) throw new Error('--tag is required');
  return { command: 'release-gate', tag, commit: requireCommit(values) };
};

const parseWaitHealthArgs = (rest: string[]): WaitHealthCommand => {
  const values = readOptions(rest, ['--url', '--commit', '--timeout']);
  const url = values.get('--url');
  if (url === undefined) throw new Error('--url is required');
  if (!/^https?:\/\//.test(url)) {
    throw new Error('--url must start with http:// or https://');
  }
  const timeout = values.get('--timeout');
  if (timeout === undefined) throw new Error('--timeout is required');
  if (!/^[1-9]\d*$/.test(timeout)) {
    throw new Error('--timeout must be a positive number of seconds');
  }
  return {
    command: 'wait-health',
    url: url.replace(/\/+$/, ''),
    commit: requireCommit(values),
    timeoutSeconds: Number(timeout),
  };
};

/** Parses the CI command line; `exists` tells whether a file is there (injected for tests). */
export const parseCiArgs = (
  argv: string[],
  exists: (file: string) => boolean,
): CiCommand => {
  const [command, ...rest] = argv;
  if (command === 'release-gate') return parseReleaseGateArgs(rest);
  if (command === 'wait-health') return parseWaitHealthArgs(rest);
  if (command === 'app-version') {
    readOptions(rest, []);
    return { command };
  }
  if (command !== 'write-manifest') {
    throw new Error(
      `Unknown command: ${command ?? '(none)'}. Use ${COMMANDS}.`,
    );
  }
  const values = readOptions(rest, OPTIONS);
  const environment = values.get('--env');
  if (environment === undefined) throw new Error('--env is required');
  if (environment !== 'staging' && environment !== 'production') {
    throw new Error(`--env must be staging or production, got ${environment}`);
  }
  const commit = requireCommit(values);
  for (const option of ['--server', '--fdroid']) {
    const file = values.get(option);
    if (file !== undefined && !exists(file)) {
      throw new Error(`${option}: ${file} does not exist`);
    }
  }
  return {
    command,
    environment,
    commit,
    server: values.get('--server'),
    fdroid: values.get('--fdroid'),
    version: values.get('--version'),
  };
};

const sha256Of = (file: string): Promise<string> =>
  new Promise((done, fail) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', fail)
      .on('end', () => done(hash.digest('hex')));
  });

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const ROOT = resolve(__dirname, '../../../..');

/** `version` in `apps/mobile/app.config.ts`: staging delivers `X.Y.Z-staging.<n>` of it. */
const appVersion = (): string =>
  readAppVersion(
    readFileSync(resolve(ROOT, 'apps/mobile/app.config.ts'), 'utf8'),
  );

const runWriteManifest = async (args: WriteManifestCommand) => {
  const base = process.env.INIT_CWD ?? process.cwd();
  const repository = required('GITHUB_REPOSITORY');
  const runner = createCommandRunner();
  const flake = JSON.parse(readFileSync(resolve(ROOT, 'flake.lock'), 'utf8'));
  const version = args.version ?? appVersion();
  const asset = async (file?: string) =>
    file === undefined
      ? undefined
      : {
          path: resolve(base, file),
          sha256: await sha256Of(resolve(base, file)),
        };
  const runId = Number(required('GITHUB_RUN_ID'));
  const manifest = await writeManifest(
    {
      source: createGithubChannelSource({
        repository,
        token: required('GITHUB_TOKEN'),
      }),
      publisher: createGithubChannelPublisher(runner, repository),
      signer: createSshSigner(required('DEPLOY_SIGNING_KEY')),
      clock: createSystemClock(),
    },
    {
      environment: args.environment,
      commit: args.commit,
      sequence: Number(
        (
          await runner.run('git', ['rev-list', '--count', args.commit], {
            cwd: ROOT,
          })
        ).stdout,
      ),
      version,
      nixpkgsRev: flake.nodes.nixpkgs.locked.rev,
      minAgentVersion: '1.0.0',
      run: {
        id: runId,
        url: `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repository}/actions/runs/${runId}`,
      },
      server: await asset(args.server),
      fdroid: await asset(args.fdroid),
    },
  );
  console.log(
    `Published ${manifest.version} (${manifest.commit}) to ${args.environment}`,
  );
};

const runReleaseGate = async (args: ReleaseGateCommand) => {
  const repository = required('GITHUB_REPOSITORY');
  const runner = createCommandRunner();
  const failures = await releaseGate(
    {
      git: createGitFacts(runner, ROOT),
      runs: createGithubRunHistory(runner, repository, REQUIRED_WORKFLOWS),
      source: createGithubChannelSource({
        repository,
        token: required('GITHUB_TOKEN'),
      }),
    },
    { tag: args.tag, commit: args.commit },
  );
  if (failures.length > 0) {
    console.error(`The release ${args.tag} cannot go ahead:`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`The release ${args.tag} passes the gate`);
};

const runWaitHealth = async (args: WaitHealthCommand) => {
  const result = await waitForHealthyCommit(
    args.url,
    args.commit,
    args.timeoutSeconds * 1000,
    { pollMs: 20_000, requestTimeoutMs: 10_000 },
  );
  if (result !== 'healthy') {
    console.error(
      `${args.url} did not report commit ${args.commit} within ${args.timeoutSeconds} s (${result}). The Pi's report says why.`,
    );
    process.exit(1);
  }
  console.log(`${args.url} runs commit ${args.commit}`);
};

if (require.main === module) {
  (async () => {
    const args = parseCiArgs(process.argv.slice(2), (file) =>
      existsSync(resolve(process.env.INIT_CWD ?? process.cwd(), file)),
    );
    if (args.command === 'release-gate') await runReleaseGate(args);
    else if (args.command === 'wait-health') await runWaitHealth(args);
    else if (args.command === 'app-version') console.log(appVersion());
    else await runWriteManifest(args);
  })().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
