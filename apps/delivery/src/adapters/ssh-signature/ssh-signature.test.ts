import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSshSigner, createSshVerifier } from './ssh-signature';

let dir: string;
let privateKey: string;
let allowedSigners: string;

const generateKey = (name: string) => {
  const file = join(dir, name);
  execFileSync('ssh-keygen', [
    '-t',
    'ed25519',
    '-N',
    '',
    '-C',
    'test',
    '-f',
    file,
    '-q',
  ]);
  return {
    private: readFileSync(file, 'utf8'),
    public: readFileSync(`${file}.pub`, 'utf8').trim(),
  };
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-ssh-test-'));
  const key = generateKey('trusted');
  privateKey = key.private;
  // `allowed_signers`: principal, then the namespaces option, then the key (type and base64 only).
  const [type, base64] = key.public.split(' ');
  allowedSigners = join(dir, 'allowed_signers');
  writeFileSync(
    allowedSigners,
    `mes-courses-deploy namespaces="mes-courses-deploy" ${type} ${base64}\n`,
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('ssh signature', () => {
  it('verifies a signed manifest', async () => {
    const signature = await createSshSigner(privateKey).sign('{"schema":1}');

    await expect(
      createSshVerifier(allowedSigners).verify('{"schema":1}', signature),
    ).resolves.toBe(true);
  });

  it('refuses a content that changed by one byte', async () => {
    const signature = await createSshSigner(privateKey).sign('{"schema":1}');

    await expect(
      createSshVerifier(allowedSigners).verify('{"schema":2}', signature),
    ).resolves.toBe(false);
  });

  it('refuses a signature made with another key', async () => {
    const other = generateKey('other');
    const signature = await createSshSigner(other.private).sign('{"schema":1}');

    await expect(
      createSshVerifier(allowedSigners).verify('{"schema":1}', signature),
    ).resolves.toBe(false);
  });

  it('refuses a signature made in another namespace', async () => {
    const file = join(dir, 'content');
    writeFileSync(file, '{"schema":1}');
    const keyFile = join(dir, 'trusted');
    execFileSync('ssh-keygen', [
      '-Y',
      'sign',
      '-f',
      keyFile,
      '-n',
      'something-else',
      file,
    ]);
    const signature = readFileSync(`${file}.sig`, 'utf8');

    await expect(
      createSshVerifier(allowedSigners).verify('{"schema":1}', signature),
    ).resolves.toBe(false);
  });

  it('refuses garbage instead of a signature', async () => {
    await expect(
      createSshVerifier(allowedSigners).verify('x', 'not a signature'),
    ).resolves.toBe(false);
  });
});
