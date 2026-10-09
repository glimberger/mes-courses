import { err } from '../../domain/result';
import type { SyncServer } from '../ports/sync-server';

/** A sync server nobody can reach, for tests and stories that do not exercise synchronization. */
export class OfflineSyncServer implements SyncServer {
  health: SyncServer['health'] = async () => err({ type: 'ServerUnreachable' });
  claim: SyncServer['claim'] = async () => err({ type: 'ServerUnreachable' });
  sync: SyncServer['sync'] = async () => err({ type: 'Offline' });
  createPairingCode: SyncServer['createPairingCode'] = async () =>
    err({ type: 'Offline' });
  listDevices: SyncServer['listDevices'] = async () => err({ type: 'Offline' });
  renameDevice: SyncServer['renameDevice'] = async () =>
    err({ type: 'Offline' });
  revokeDevice: SyncServer['revokeDevice'] = async () =>
    err({ type: 'Offline' });
}
