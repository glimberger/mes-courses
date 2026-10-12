import type { DeviceSummary } from '@mes-courses/sync-core';

import type { Clock } from '../ports/clock';
import type { ServerStore } from '../ports/store';

export type DevicesDeps = { store: ServerStore; clock: Clock };

/** The caller's authorized devices, revoked ones excluded (US4-8). Another account's are never listed. */
export const listDevices = async (
  { store }: DevicesDeps,
  accountId: string,
): Promise<DeviceSummary[]> =>
  store.run(async ({ devices }) =>
    (await devices.forAccount(accountId))
      .filter((device) => device.revokedAt === null)
      .map(({ id, name, createdAt, lastSyncAt }) => ({
        id,
        name,
        createdAt,
        lastSyncAt,
      })),
  );
