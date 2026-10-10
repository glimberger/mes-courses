import type { DeviceSummary } from '@mes-courses/sync-core';

import { ok, type Result } from '../../domain/result';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncFailure, SyncServer } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

export type DeviceInfo = DeviceSummary & { isThisDevice: boolean };

/** The authorized devices, with this one marked (US4-8). */
export const createListDevices =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    syncServer: SyncServer;
  }) =>
  async (): Promise<Result<DeviceInfo[], SyncFailure>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    const devices = await deps.syncServer.listDevices(conn.value);
    if (!devices.ok) return devices;
    return ok(
      devices.value.map((device) => ({
        ...device,
        isThisDevice: device.id === conn.value.deviceId,
      })),
    );
  };
