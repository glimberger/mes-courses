import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PortOverride } from '../../application/ports/port-override';
import { ENVIRONMENT_SETTINGS } from '../../domain/environments';

/**
 * `<runDirectory>/<env>.env`, which the unit reads after `/etc/mes-courses/<env>.env`: while it
 * exists the service listens on the validation port, where Caddy has nothing to reach.
 */
export const createFilePortOverride = (runDirectory: string): PortOverride => {
  const fileOf = (environment: string) =>
    join(runDirectory, `${environment}.env`);
  return {
    async useValidationPort(environment) {
      await mkdir(runDirectory, { recursive: true });
      await writeFile(
        fileOf(environment),
        `MES_COURSES_PORT=${ENVIRONMENT_SETTINGS[environment].validationPort}\n`,
      );
    },
    async usePublicPort(environment) {
      await rm(fileOf(environment), { force: true });
    },
  };
};
