import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { SignatureVerifier } from '../../application/ports/signature-verifier';
import type { Signer } from '../../application/ports/signer';

const execFileAsync = promisify(execFile);

export const SIGNATURE_NAMESPACE = 'mes-courses-deploy';
/** The principal an `allowed_signers` line names. */
export const SIGNER_IDENTITY = 'mes-courses-deploy';

const inTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'mes-courses-sign-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/** Signs with `ssh-keygen -Y sign`. The key is handed over as a file (mode 600), never as an argument. */
export const createSshSigner = (privateKey: string): Signer => ({
  sign: (content) =>
    inTempDir(async (dir) => {
      const keyFile = join(dir, 'key');
      const dataFile = join(dir, 'data');
      await writeFile(
        keyFile,
        privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`,
        {
          mode: 0o600,
        },
      );
      await writeFile(dataFile, content);
      await execFileAsync('ssh-keygen', [
        '-Y',
        'sign',
        '-f',
        keyFile,
        '-n',
        SIGNATURE_NAMESPACE,
        dataFile,
      ]);
      return readFile(`${dataFile}.sig`, 'utf8');
    }),
});

/** Verifies with `ssh-keygen -Y verify` against the `allowed_signers` file. */
export const createSshVerifier = (
  allowedSignersFile: string,
): SignatureVerifier => ({
  verify: (content, signature) =>
    inTempDir(async (dir) => {
      const signatureFile = join(dir, 'data.sig');
      await writeFile(signatureFile, signature);
      return new Promise<boolean>((resolve, reject) => {
        const child = spawn(
          'ssh-keygen',
          [
            '-Y',
            'verify',
            '-f',
            allowedSignersFile,
            '-I',
            SIGNER_IDENTITY,
            '-n',
            SIGNATURE_NAMESPACE,
            '-s',
            signatureFile,
          ],
          { stdio: ['pipe', 'ignore', 'ignore'] },
        );
        child.on('error', reject);
        child.on('close', (code) => resolve(code === 0));
        child.stdin.on('error', () => undefined);
        child.stdin.end(content);
      });
    }),
});
