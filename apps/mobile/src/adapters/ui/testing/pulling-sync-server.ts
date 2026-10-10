import type { Hlc, ServerRow } from '@mes-courses/sync-core';

import type { SyncServer } from '../../../application/ports/sync-server';
import { ok } from '../../../domain/result';

/** The stamp of the changes another device made, older than any a test makes here. */
export const OTHER_DEVICE_HLC: Hlc = {
  wallMs: 10,
  counter: 0,
  deviceId: 'other-device',
};

/**
 * A fake `SyncServer.sync` for a device that starts connected (`StoryScenario.connected`): it
 * answers with the rows given to `send`, once, as another device's changes would arrive at the
 * next cycle, and with nothing otherwise.
 */
export const pullingSyncServer = () => {
  let waiting: ServerRow[] = [];
  const sync: SyncServer['sync'] = async () => {
    const rows = waiting;
    waiting = [];
    return ok({
      serverId: 'story-server',
      apiVersion: 1,
      minAppVersion: '1.0.0',
      acknowledged: [],
      rows,
      seq: 1,
      hlc: OTHER_DEVICE_HLC,
    });
  };
  return {
    syncServer: { sync },
    send: (rows: ServerRow[]) => {
      waiting = rows;
    },
  };
};
