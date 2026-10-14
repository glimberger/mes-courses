import type { AccountInfo } from '@mes-courses/sync-core';

import type { Result } from '../../domain/result';
import type { AccountServer } from '../ports/account-server';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncFailure, SyncServer } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';
import { createGetSyncInfo, type SyncInfo } from './get-sync-info';
import { createListDevices, type DeviceInfo } from './list-devices';

/**
 * The read model of Settings (US6-1). The address and the role come from the server on every
 * call and are never stored: offline, they are simply not available, and the devices list has the
 * error state of 003. `account` and `devices` are `null` for a device that never signed in.
 */
export type AccountSettings = {
  sync: SyncInfo;
  account: Result<AccountInfo, SyncFailure> | null;
  devices: Result<DeviceInfo[], SyncFailure> | null;
};

export const createGetAccountSettings = (deps: {
  unitOfWork: UnitOfWork;
  credentials: CredentialStore;
  syncServer: SyncServer;
  accountServer: AccountServer;
}) => {
  const getSyncInfo = createGetSyncInfo(deps);
  const listDevices = createListDevices(deps);
  return async (): Promise<AccountSettings> => {
    const sync = await getSyncInfo();
    if (sync.connection === 'notConnected') {
      return { sync, account: null, devices: null };
    }
    const conn = await currentConnection(deps);
    if (!conn.ok) return { sync, account: conn, devices: conn };
    const [account, devices] = await Promise.all([
      deps.accountServer.getAccount(conn.value),
      listDevices(),
    ]);
    return { sync, account, devices };
  };
};
