import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { StateStore } from '../../application/ports/state-store';
import { emptyInstanceState } from '../../domain/instance-state';

/** `<directory>/<env>.json`, written through a temporary file and a rename. */
export const createFileStateStore = (directory: string): StateStore => {
  const fileOf = (environment: string) =>
    join(directory, `${environment}.json`);
  return {
    async load(environment) {
      try {
        return {
          ...emptyInstanceState(),
          ...JSON.parse(await readFile(fileOf(environment), 'utf8')),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
          return emptyInstanceState();
        throw error;
      }
    },
    async save(environment, state) {
      const file = fileOf(environment);
      await mkdir(dirname(file), { recursive: true });
      const temporary = `${file}.tmp-${process.pid}`;
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
      await rename(temporary, file);
    },
  };
};
