import { err, ok, type Result } from '../../domain/result';
import type { CredentialStore } from '../ports/credential-store';
import type {
  InvalidCode,
  ServerUnreachable,
  SyncServer,
  TooManyAttempts,
  UntrustedServer,
} from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';

/** The address typed is not a usable server address. */
export type InvalidUrl = { type: 'InvalidUrl' };

/** The credential or the connection could not be saved on this device; the code is used up. */
export type StorageFailed = { type: 'StorageFailed' };

export type ConnectError =
  | InvalidUrl
  | StorageFailed
  | ServerUnreachable
  | UntrustedServer
  | InvalidCode
  | TooManyAttempts;

/** `host`, `host:port` or an IPv4 address; letters, digits, dots and hyphens in the host. */
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/;

/**
 * The server address as stored: `https://` added when no scheme is typed, host in lower case,
 * trailing slashes dropped. `http://` is refused unless `allowInsecure` (development only,
 * FR-019). Returns `null` for anything else.
 */
const normalizeUrl = (typed: string, allowInsecure: boolean): string | null => {
  const match = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(.*)$/i.exec(typed.trim());
  const scheme = (match?.[1] ?? 'https').toLowerCase();
  if (scheme !== 'https' && !(scheme === 'http' && allowInsecure)) return null;
  const rest = (match?.[2] ?? '').replace(/\/+$/, '');
  const [authority = '', ...path] = rest.split('/');
  if (!HOST.test(authority.toLowerCase())) return null;
  return `${scheme}://${[authority.toLowerCase(), ...path].join('/')}`;
};

/**
 * Pairs this device with a server (US4-4, US4-6): checks the server answers, claims the code, then
 * keeps the credential in the credential store only and the connection fields in `sync_state`.
 * Any failure changes nothing. The first sync is left to the scheduler.
 */
export const createConnectToServer =
  ({
    unitOfWork,
    syncServer,
    credentials,
    allowInsecure = false,
  }: {
    unitOfWork: UnitOfWork;
    syncServer: SyncServer;
    credentials: CredentialStore;
    /** Accepts `http://` addresses; set by the composition in development builds only. */
    allowInsecure?: boolean;
  }) =>
  async (
    typedUrl: string,
    code: string,
    deviceName: string,
  ): Promise<Result<void, ConnectError>> => {
    const url = normalizeUrl(typedUrl, allowInsecure);
    if (url === null) return err({ type: 'InvalidUrl' });

    const health = await syncServer.health(url);
    if (!health.ok) return health;

    const pairing = await syncServer.claim(url, code, deviceName);
    if (!pairing.ok) return pairing;

    // The credential first: a connection with no credential reads as disconnected (FR-018b),
    // while a credential with no connection is simply unused.
    try {
      await credentials.write(pairing.value.credential);
      await unitOfWork.run(async (repos) => {
        const current = await repos.syncState.get();
        await repos.syncState.save({
          ...current,
          serverUrl: url,
          serverId: pairing.value.serverId,
          deviceId: pairing.value.deviceId,
          lastSeq: 0,
          lastSyncAt: null,
          // The first sync re-stamps the snapshot with the new device id (research R13).
          snapshotDone: false,
        });
      });
    } catch {
      return err({ type: 'StorageFailed' });
    }
    return ok(undefined);
  };
