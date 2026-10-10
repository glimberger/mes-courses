import { err, ok, type Result } from '../../domain/result';
import type {
  ServerUnreachable,
  SyncServer,
  UntrustedServer,
} from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import type { InvalidUrl } from './connect-to-server';
import { normalizeUrl } from './normalize-url';

/** The server at the new address is not the one this device is paired with. */
export type ServerMismatch = { type: 'ServerMismatch' };

export type ChangeServerUrlError =
  InvalidUrl | ServerMismatch | ServerUnreachable | UntrustedServer;

/**
 * Moves the connection to a new address of the same server (the domain name changed, FR-016).
 * Only the address is saved: the credential, the pending changes and `lastSeq` stay. Any failure
 * changes nothing.
 */
export const createChangeServerUrl =
  ({
    unitOfWork,
    syncServer,
    allowInsecure = false,
  }: {
    unitOfWork: UnitOfWork;
    syncServer: SyncServer;
    allowInsecure?: boolean;
  }) =>
  async (typedUrl: string): Promise<Result<void, ChangeServerUrlError>> => {
    const url = normalizeUrl(typedUrl, allowInsecure);
    if (url === null) return err({ type: 'InvalidUrl' });

    const health = await syncServer.health(url);
    if (!health.ok) return health;

    return unitOfWork.run(async (repos) => {
      const current = await repos.syncState.get();
      if (
        current.serverId === null ||
        health.value.serverId !== current.serverId
      ) {
        return err({ type: 'ServerMismatch' } as const);
      }
      await repos.syncState.save({ ...current, serverUrl: url });
      return ok(undefined);
    });
  };
