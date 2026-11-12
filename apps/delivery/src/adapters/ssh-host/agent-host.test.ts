import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ScriptedCommandRunner } from '../../application/testing/in-memory-doubles';
import { createSshAgentHost, REMOTE_SCRIPT } from './agent-host';

const release = {
  tag: 'v2.3.0',
  agentVersion: '1.1.0',
  assetId: 42,
  assetName: 'delivery-1.1.0.tar.gz',
};

describe('ssh agent host', () => {
  it('sends the script on stdin and only a version and a number as arguments', async () => {
    const runner = new ScriptedCommandRunner();
    const calls: string[][] = [];
    const run = runner.run.bind(runner);
    runner.run = async (command, args, options) => {
      calls.push([command, ...args]);
      return run(command, args, options);
    };
    const host = createSshAgentHost(runner, 'agent-pi', 'SCRIPT');
    await host.install(release);
    expect(calls[0]).toEqual([
      'ssh',
      '-o',
      'BatchMode=yes',
      'agent-pi',
      'sudo',
      '-n',
      'sh',
      '-s',
      '--',
      'install',
      '1.1.0',
      '42',
    ]);
    expect(runner.inputs).toEqual(['SCRIPT']);
  });

  it('reads the current version, null when empty', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ stdout: '1.0.0\n' }, { stdout: '\n' });
    const host = createSshAgentHost(runner, 'agent-pi', 's');
    await expect(host.currentVersion()).resolves.toBe('1.0.0');
    await expect(host.currentVersion()).resolves.toBeNull();
  });

  it('tells ready (0), not ready (10) and a failure (anything else)', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ exitCode: 0 }, { exitCode: 10 }, { exitCode: 255 });
    const host = createSshAgentHost(runner, 'agent-pi', 's');
    await expect(host.isReady('1.1.0')).resolves.toBe(true);
    await expect(host.isReady('1.1.0')).resolves.toBe(false);
    await expect(host.isReady('1.1.0')).rejects.toThrow(/255/);
  });

  it('turns a failure and a timeout into errors naming the operation', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push(
      { exitCode: 1, stderr: 'no space left\n' },
      { exitCode: 137, timedOut: true },
    );
    const host = createSshAgentHost(runner, 'agent-pi', 's');
    await expect(host.buildRuntime('1.1.0')).rejects.toThrow(
      /`build`.*no space left/,
    );
    await expect(host.activate('1.1.0')).rejects.toThrow(/time limit/);
  });

  it('returns the trimmed status', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ stdout: 'agent 1.1.0\n' });
    await expect(
      createSshAgentHost(runner, 'agent-pi', 's').status(),
    ).resolves.toBe('agent 1.1.0');
  });
});

/** The script itself, run against a temporary root with a fake curl and a fake nix. */
describe('agent-host.sh', () => {
  let dir: string;
  let bin: string;
  let root: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-host-'));
    bin = join(dir, 'bin');
    root = join(dir, 'agent');
    mkdirSync(bin);
    mkdirSync(join(root, 'releases'), { recursive: true });
    writeFileSync(
      join(dir, 'agent.env'),
      'GITHUB_REPOSITORY=o/r\nGITHUB_TOKEN=tok-secret\n',
    );
    // curl: records its arguments and the header read from stdin, then writes a bundle.
    writeFileSync(
      join(bin, 'curl'),
      `#!/bin/sh
echo "$@" >"${dir}/curl-args"
cat >"${dir}/curl-stdin"
[ ! -f "${dir}/curl-fails" ] || exit 22
while [ "$#" -gt 0 ]; do [ "$1" = --output ] && out=$2; shift; done
cp "${dir}/bundle.tar.gz" "$out"
`,
    );
    writeFileSync(
      join(bin, 'nix'),
      `#!/bin/sh
[ ! -f "${dir}/nix-fails" ] || exit 1
echo "$@" >"${dir}/nix-args"
while [ "$#" -gt 0 ]; do [ "$1" = --out-link ] && link=$2; shift; done
mkdir -p "${dir}/store/bin"
printf '#!/bin/sh\\necho "agent status ok"\\n' >"${dir}/store/bin/node"
chmod +x "${dir}/store/bin/node"
ln -s "${dir}/store" "$link"
`,
    );
    chmodSync(join(bin, 'curl'), 0o755);
    chmodSync(join(bin, 'nix'), 0o755);
    const bundle = join(dir, 'bundle');
    mkdirSync(join(bundle, 'apps/delivery/dist/composition'), {
      recursive: true,
    });
    writeFileSync(join(bundle, 'apps/delivery/dist/composition/main.js'), '');
    writeFileSync(join(bundle, 'nixpkgs-rev'), `${'a'.repeat(40)}\n`);
    spawnSync('tar', ['-czf', join(dir, 'bundle.tar.gz'), '-C', bundle, '.']);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const sh = (...args: string[]) =>
    spawnSync('sh', ['-s', '--', ...args], {
      input: readFileSync(REMOTE_SCRIPT),
      encoding: 'utf8',
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        AGENT_ROOT: root,
        AGENT_ENV_FILE: join(dir, 'agent.env'),
      },
    });

  it('installs, builds, then repoints, keeping the previous release', () => {
    mkdirSync(join(root, 'releases/1.0.0'));
    symlinkSync(join(root, 'releases/1.0.0'), join(root, 'current'));
    expect(sh('current').stdout.trim()).toBe('1.0.0');
    expect(sh('ready', '1.1.0').status).toBe(10);

    expect(sh('install', '1.1.0', '42').status).toBe(0);
    expect(sh('ready', '1.1.0').status).toBe(10);
    expect(readlinkSync(join(root, 'current'))).toBe(
      join(root, 'releases/1.0.0'),
    );
    // the token travels on the curl pipe only
    expect(readFileSync(join(dir, 'curl-stdin'), 'utf8')).toBe(
      'Authorization: Bearer tok-secret\n',
    );
    expect(readFileSync(join(dir, 'curl-args'), 'utf8')).not.toContain(
      'tok-secret',
    );

    expect(sh('build', '1.1.0').stderr).toBe('');
    expect(readFileSync(join(dir, 'nix-args'), 'utf8')).toContain(
      `github:NixOS/nixpkgs/${'a'.repeat(40)}#nodejs_24`,
    );
    expect(sh('ready', '1.1.0').status).toBe(0);
    expect(readlinkSync(join(root, 'current'))).toBe(
      join(root, 'releases/1.0.0'),
    );

    expect(sh('activate', '1.1.0').status).toBe(0);
    expect(readlinkSync(join(root, 'current'))).toBe(
      join(root, 'releases/1.1.0'),
    );
    expect(lstatSync(join(root, 'runtime')).isSymbolicLink()).toBe(true);
    expect(existsSync(join(root, 'releases/1.0.0'))).toBe(true);
    expect(sh('current').stdout.trim()).toBe('1.1.0');
  });

  it('treats an incomplete earlier unpack as not installed and starts again', () => {
    const half = join(root, 'releases/1.1.0');
    mkdirSync(half);
    writeFileSync(join(half, '.installing'), '');
    writeFileSync(join(half, 'stale'), '');
    expect(sh('ready', '1.1.0').status).toBe(10);
    expect(sh('activate', '1.1.0').status).not.toBe(0);
    expect(sh('install', '1.1.0', '42').status).toBe(0);
    expect(existsSync(join(half, 'stale'))).toBe(false);
  });

  it('leaves current alone when the download fails', () => {
    mkdirSync(join(root, 'releases/1.0.0'));
    symlinkSync(join(root, 'releases/1.0.0'), join(root, 'current'));
    writeFileSync(join(dir, 'curl-fails'), '');
    expect(sh('install', '1.1.0', '42').status).not.toBe(0);
    expect(readlinkSync(join(root, 'current'))).toBe(
      join(root, 'releases/1.0.0'),
    );
    expect(sh('ready', '1.1.0').status).toBe(10);
  });

  it('does not mark a release ready when the runtime build fails', () => {
    expect(sh('install', '1.1.0', '42').status).toBe(0);
    writeFileSync(join(dir, 'nix-fails'), '');
    expect(sh('build', '1.1.0').status).not.toBe(0);
    expect(sh('ready', '1.1.0').status).toBe(10);
    expect(sh('activate', '1.1.0').status).not.toBe(0);
    expect(existsSync(join(root, 'current'))).toBe(false);
  });

  it('never replaces the release current points at', () => {
    expect(sh('install', '1.1.0', '42').status).toBe(0);
    expect(sh('build', '1.1.0').stderr).toBe('');
    expect(sh('activate', '1.1.0').status).toBe(0);
    expect(sh('install', '1.1.0', '42').status).not.toBe(0);
    expect(sh('ready', '1.1.0').status).toBe(0);
  });

  it('refuses a malformed version or asset id', () => {
    expect(sh('ready', '1.1.0; rm -rf /').status).not.toBe(0);
    expect(sh('install', '1.1.0', 'x').status).not.toBe(0);
    expect(sh('ready', '../x').status).not.toBe(0);
  });

  it('prints the status of the agent with the env file loaded', () => {
    expect(sh('install', '1.1.0', '42').status).toBe(0);
    expect(sh('build', '1.1.0').stderr).toBe('');
    expect(sh('activate', '1.1.0').status).toBe(0);
    expect(sh('status').stdout.trim()).toBe('agent status ok');
  });
});
