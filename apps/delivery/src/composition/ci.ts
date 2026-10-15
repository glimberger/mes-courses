import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { writeManifest } from '../application/write-manifest';
import { createGithubChannelPublisher } from '../adapters/github/channel-publisher';
import { createGithubChannelSource } from '../adapters/github/channel-source';
import { createCommandRunner } from '../adapters/process/command-runner';
import { createSshSigner } from '../adapters/ssh-signature/ssh-signature';
import { createSystemClock } from '../adapters/system/clock';
import type { Environment } from '../domain/manifest';

export type CiCommand = {
  command: 'write-manifest';
  environment: Environment;
  commit: string;
  server?: string | undefined;
  fdroid?: string | undefined;
  version?: string | undefined;
};

const OPTIONS = ['--env', '--commit', '--server', '--fdroid', '--version'];

/** Parses the CI command line; `exists` tells whether a file is there (injected for tests). */
export const parseCiArgs = (
  argv: string[],
  exists: (file: string) => boolean,
): CiCommand => {
  const [command, ...rest] = argv;
  if (command !== 'write-manifest') {
    throw new Error(
      `Unknown command: ${command ?? '(none)'}. Use write-manifest.`,
    );
  }
  const values = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const option = rest[i] as string;
    if (!OPTIONS.includes(option)) throw new Error(`Unknown option: ${option}`);
    const value = rest[i + 1];
    if (value === undefined) throw new Error(`${option} needs a value`);
    values.set(option, value);
  }
  const environment = values.get('--env');
  if (environment === undefined) throw new Error('--env is required');
  if (environment !== 'staging' && environment !== 'production') {
    throw new Error(`--env must be staging or production, got ${environment}`);
  }
  const commit = values.get('--commit');
  if (commit === undefined) throw new Error('--commit is required');
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error('--commit must be 40 lowercase hex characters');
  }
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

const runWriteManifest = async (args: CiCommand) => {
  const base = process.env.INIT_CWD ?? process.cwd();
  const repository = required('GITHUB_REPOSITORY');
  const runner = createCommandRunner();
  const flake = JSON.parse(readFileSync(resolve(ROOT, 'flake.lock'), 'utf8'));
  const version =
    args.version ??
    JSON.parse(readFileSync(resolve(ROOT, 'apps/server/package.json'), 'utf8'))
      .version;
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

if (require.main === module) {
  (async () => {
    const args = parseCiArgs(process.argv.slice(2), (file) =>
      existsSync(resolve(process.env.INIT_CWD ?? process.cwd(), file)),
    );
    await runWriteManifest(args);
  })().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
