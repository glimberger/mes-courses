import type {
  HealthInfo,
  DeviceSummary,
  SyncRequest,
  SyncResponse,
} from '@mes-courses/sync-core';
import { err, ok, type Result } from '../../domain/result';
import type {
  Connection,
  DeviceNotFound,
  SyncFailure,
  SyncServer,
} from '../../application/ports/sync-server';
import {
  createSend,
  syncFailure,
  transportFailure,
  type Answer,
  type TransportOptions,
} from './transport';

export { REQUEST_TIMEOUT_MS } from './transport';

export type SyncServerOptions = TransportOptions;

const isHealthInfo = (body: unknown): body is HealthInfo =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as HealthInfo).serverId === 'string' &&
  typeof (body as HealthInfo).apiVersion === 'number' &&
  typeof (body as HealthInfo).minAppVersion === 'string';

const isSyncResponse = (body: unknown): body is SyncResponse =>
  typeof body === 'object' &&
  body !== null &&
  Array.isArray((body as SyncResponse).acknowledged) &&
  Array.isArray((body as SyncResponse).rows) &&
  typeof (body as SyncResponse).seq === 'number';

/** The `SyncServer` over `fetch` (see `transport.ts` for how failures are told apart). */
export const createSyncServer = (options: SyncServerOptions): SyncServer => {
  const send = createSend(options);

  /** A rename or a revocation: `success` is the status of a done request, 404 an unknown device. */
  const deviceOutcome = (
    answer: Answer,
    success: number,
  ): Result<void, SyncFailure | DeviceNotFound> => {
    if (answer.kind !== 'response') return transportFailure(answer);
    if (answer.status === success) return ok(undefined);
    if (answer.status === 404) return err({ type: 'NotFound' });
    return err(syncFailure(answer));
  };

  return {
    async health(url) {
      const answer = await send(url, '/v1/health', { method: 'GET' });
      if (answer.kind === 'untrusted') return err({ type: 'UntrustedServer' });
      if (answer.kind === 'unreachable' || answer.status !== 200) {
        return err({ type: 'ServerUnreachable' });
      }
      // A captive portal may answer 200 with something that is not the server's identity.
      return isHealthInfo(answer.body)
        ? ok(answer.body)
        : err({ type: 'ServerUnreachable' });
    },

    async sync(
      conn: Connection,
      request: SyncRequest,
    ): Promise<Result<SyncResponse, SyncFailure>> {
      const answer = await send(conn.url, '/v1/sync', {
        method: 'POST',
        body: request,
        credential: conn.credential,
      });
      if (answer.kind === 'untrusted') return err({ type: 'UntrustedServer' });
      if (answer.kind === 'unreachable') return err({ type: 'Offline' });
      if (answer.status === 200) {
        // A captive portal may answer 200 with something that is not a sync response.
        return isSyncResponse(answer.body)
          ? ok(answer.body)
          : err({ type: 'ServerError' });
      }
      return err(syncFailure(answer));
    },

    async listDevices(
      conn: Connection,
    ): Promise<Result<DeviceSummary[], SyncFailure>> {
      const answer = await send(conn.url, '/v1/devices', {
        method: 'GET',
        credential: conn.credential,
      });
      if (answer.kind !== 'response') return transportFailure(answer);
      const devices = (answer.body as { devices?: unknown } | null)?.devices;
      if (answer.status === 200 && Array.isArray(devices)) {
        return ok(devices as DeviceSummary[]);
      }
      return err(syncFailure(answer));
    },

    async renameDevice(conn, id, name) {
      const answer = await send(
        conn.url,
        `/v1/devices/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: { name },
          credential: conn.credential,
        },
      );
      return deviceOutcome(answer, 200);
    },

    async revokeDevice(conn, id) {
      const answer = await send(
        conn.url,
        `/v1/devices/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          credential: conn.credential,
        },
      );
      return deviceOutcome(answer, 204);
    },
  };
};
