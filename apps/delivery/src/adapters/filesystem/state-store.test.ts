import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { emptyInstanceState, markFailed } from '../../domain/instance-state';
import { createFileStateStore } from './state-store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-state-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('file state store', () => {
  it('gives an empty state when there is no file', async () => {
    await expect(createFileStateStore(dir).load('staging')).resolves.toEqual(
      emptyInstanceState(),
    );
  });

  it('gives back what it saved, per environment', async () => {
    const store = createFileStateStore(dir);
    const state = markFailed(
      { ...emptyInstanceState(), manifestSequence: 7 },
      'a'.repeat(40),
    );

    await store.save('staging', state);

    await expect(store.load('staging')).resolves.toEqual(state);
    await expect(store.load('production')).resolves.toEqual(
      emptyInstanceState(),
    );
  });

  it('creates the folder and leaves no temporary file', async () => {
    const nested = join(dir, 'var', 'lib');

    await createFileStateStore(nested).save('production', emptyInstanceState());

    expect(readdirSync(nested)).toEqual(['production.json']);
  });

  it('keeps the old file when the write is interrupted before the rename', async () => {
    const store = createFileStateStore(dir);
    await store.save('staging', {
      ...emptyInstanceState(),
      manifestSequence: 1,
    });
    // A directory in the way of the temporary file makes the write fail before the rename.
    mkdirSync(join(dir, `staging.json.tmp-${process.pid}`));

    await expect(
      store.save('staging', { ...emptyInstanceState(), manifestSequence: 2 }),
    ).rejects.toThrow();

    expect(
      JSON.parse(readFileSync(join(dir, 'staging.json'), 'utf8'))
        .manifestSequence,
    ).toBe(1);
  });

  it('refuses a file that is not JSON instead of hiding it', async () => {
    writeFileSync(join(dir, 'staging.json'), '{ nope');

    await expect(createFileStateStore(dir).load('staging')).rejects.toThrow();
  });
});
