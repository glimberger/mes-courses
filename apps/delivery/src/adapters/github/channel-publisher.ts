import type { ChannelPublisher } from '../../application/ports/channel-publisher';
import type { CommandRunner } from '../../application/ports/command-runner';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const KEEP = ['manifest.json', 'manifest.json.sig'];

/** CI's side of a channel, through the `gh` CLI (already authenticated in the workflow). */
export const createGithubChannelPublisher = (
  runner: CommandRunner,
  repository: string,
): ChannelPublisher => {
  const gh = async (args: string[]) => {
    const result = await runner.run('gh', args, { timeoutMs: 10 * 60_000 });
    if (result.exitCode !== 0) {
      throw new Error(
        `gh ${args[0]} ${args[1]} failed: ${result.stderr.trim()}`,
      );
    }
    return result.stdout;
  };
  const tag = (environment: string) => `channel-${environment}`;

  const ensureRelease = async (environment: string) => {
    const view = await runner.run('gh', [
      'release',
      'view',
      tag(environment),
      '--repo',
      repository,
    ]);
    if (view.exitCode === 0) return;
    await gh([
      'release',
      'create',
      tag(environment),
      '--repo',
      repository,
      '--prerelease',
      '--title',
      tag(environment),
      '--notes',
      `Rolling channel for ${environment}. Written by CI, read by the Pi.`,
    ]);
  };

  const uploadText = async (
    environment: string,
    name: string,
    content: string,
  ) => {
    const dir = await mkdtemp(join(tmpdir(), 'mes-courses-channel-'));
    try {
      const file = join(dir, name);
      await writeFile(file, content);
      await gh([
        'release',
        'upload',
        tag(environment),
        file,
        '--clobber',
        '--repo',
        repository,
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };

  return {
    async uploadAsset(environment, file) {
      await ensureRelease(environment);
      await gh([
        'release',
        'upload',
        tag(environment),
        file,
        '--clobber',
        '--repo',
        repository,
      ]);
    },
    uploadSignature: (environment, signature) =>
      uploadText(environment, 'manifest.json.sig', signature),
    uploadManifest: (environment, manifest) =>
      uploadText(environment, 'manifest.json', manifest),
    async prune(environment, referenced) {
      const listing = await gh([
        'release',
        'view',
        tag(environment),
        '--repo',
        repository,
        '--json',
        'assets',
        '--jq',
        '.assets[].name',
      ]);
      const keep = new Set([...KEEP, ...referenced]);
      for (const name of listing.split('\n').filter(Boolean)) {
        if (keep.has(name)) continue;
        await gh([
          'release',
          'delete-asset',
          tag(environment),
          name,
          '--yes',
          '--repo',
          repository,
        ]);
      }
    },
  };
};
