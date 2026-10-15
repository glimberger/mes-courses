import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, posix } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const sha256Of = (file: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });

const isUnsafePath = (path: string) =>
  path.startsWith('/') || path.split('/').includes('..');

/**
 * Refuses a member that would land outside the folder: an absolute path, a `..`, or a link that
 * leaves the folder (`node_modules/.bin` links are relative and stay inside). Names come from the
 * plain listing, which has one unambiguous name per line; link targets come from the verbose one.
 */
const assertSafeMembers = async (archive: string): Promise<void> => {
  const options = { maxBuffer: 256 * 1024 * 1024 };
  const names = await execFileAsync('tar', ['-tzf', archive], options);
  for (const name of names.stdout.split('\n')) {
    if (name !== '' && isUnsafePath(name)) {
      throw new Error(`Unsafe path in the archive: ${name}`);
    }
  }
  const verbose = await execFileAsync('tar', ['-tvzf', archive], options);
  for (const line of verbose.stdout.split('\n')) {
    const link = /^[lh]\S*\s.*? (\S.*?) (?:->|link to) (.+)$/.exec(line);
    if (!link) continue;
    const [, name, target] = link as unknown as [string, string, string];
    const resolved = posix.normalize(
      target.startsWith('/') ? target : posix.join(posix.dirname(name), target),
    );
    if (resolved.startsWith('/') || resolved.startsWith('..')) {
      throw new Error(`Unsafe link in the archive: ${name} -> ${target}`);
    }
  }
};

/**
 * Checks the archive's SHA-256, then unpacks it into a fresh `destination` (a folder that
 * existed is replaced). Nothing is unpacked when the checksum differs or a member is unsafe; the
 * folder appears all at once, by a rename.
 */
export const verifyAndUnpack = async (
  archive: string,
  sha256: string,
  destination: string,
): Promise<void> => {
  if ((await sha256Of(archive)) !== sha256) {
    throw new Error(`Checksum mismatch for ${archive}`);
  }
  await assertSafeMembers(archive);
  const partial = `${destination}.partial-${process.pid}`;
  await rm(partial, { recursive: true, force: true });
  await mkdir(partial, { recursive: true });
  try {
    await execFileAsync('tar', [
      '-xzf',
      archive,
      '-C',
      partial,
      '--no-same-owner',
      '--no-same-permissions',
    ]);
    await mkdir(dirname(destination), { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await rename(partial, destination);
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
};
