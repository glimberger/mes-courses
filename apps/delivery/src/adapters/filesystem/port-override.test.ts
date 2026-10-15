import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFilePortOverride } from './port-override';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-port-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('file port override', () => {
  it.each([
    ['production', 3100],
    ['staging', 3101],
  ] as const)('writes the %s validation port', async (environment, port) => {
    await createFilePortOverride(join(dir, 'run')).useValidationPort(
      environment,
    );
    expect(readFileSync(join(dir, 'run', `${environment}.env`), 'utf8')).toBe(
      `MES_COURSES_PORT=${port}\n`,
    );
  });

  it('removes the file to go back to the public port, and tolerates its absence', async () => {
    const override = createFilePortOverride(join(dir, 'run'));
    await override.useValidationPort('staging');
    await override.usePublicPort('staging');
    expect(existsSync(join(dir, 'run/staging.env'))).toBe(false);
    await expect(override.usePublicPort('staging')).resolves.toBeUndefined();
  });
});
