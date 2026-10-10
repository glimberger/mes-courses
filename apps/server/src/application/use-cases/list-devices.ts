import type { DeviceSummary } from '@mes-courses/sync-core';

import type { Clock } from '../ports/clock';
import type { ServerStore } from '../ports/store';

export type DevicesDeps = { store: ServerStore; clock: Clock };

/** The authorized devices, revoked ones excluded (US4-8). */
export const listDevices = async ({
  store,
}: DevicesDeps): Promise<DeviceSummary[]> =>
  store.run(async ({ devices }) =>
    (await devices.all())
      .filter((device) => device.revokedAt === null)
      .map(({ id, name, createdAt, lastSyncAt }) => ({
        id,
        name,
        createdAt,
        lastSyncAt,
      })),
  );
