import type {
  DeviceSummary,
  HealthInfo,
  SyncRequest,
  SyncResponse,
} from '@mes-courses/sync-core';
import type { Result } from '../../domain/result';

/** What a request to the server needs; built by the use cases, never stored in SQLite. */
export type Connection = { url: string; deviceId: string; credential: string };

/** No network, DNS failure, timeout or connection refused. Never reported (FR-022). */
export type Offline = { type: 'Offline' };
export type ServerUnreachable = { type: 'ServerUnreachable' };
/** 401: the server no longer knows this device. */
export type DeviceNotAuthorized = { type: 'DeviceNotAuthorized' };
export type UpdateRequired = { type: 'UpdateRequired' };
/** 5xx or an unexpected response. */
export type ServerError = { type: 'ServerError' };
/** TLS verification failed (FR-019): never retried insecurely. */
export type UntrustedServer = { type: 'UntrustedServer' };
export type TooManyAttempts = {
  type: 'TooManyAttempts';
  minutesToWait: number;
};
export type DeviceNotFound = { type: 'NotFound' };

export type SyncFailure =
  | Offline
  | DeviceNotAuthorized
  | UpdateRequired
  | ServerError
  | UntrustedServer;

/** The HTTP adapter; tests never reach the production server. */
export interface SyncServer {
  health(
    url: string,
  ): Promise<Result<HealthInfo, ServerUnreachable | UntrustedServer>>;
  sync(
    conn: Connection,
    request: SyncRequest,
  ): Promise<Result<SyncResponse, SyncFailure>>;
  listDevices(conn: Connection): Promise<Result<DeviceSummary[], SyncFailure>>;
  renameDevice(
    conn: Connection,
    id: string,
    name: string,
  ): Promise<Result<void, SyncFailure | DeviceNotFound>>;
  revokeDevice(
    conn: Connection,
    id: string,
  ): Promise<Result<void, SyncFailure | DeviceNotFound>>;
}
