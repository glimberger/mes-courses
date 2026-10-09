import type {
  ErrorBody,
  HealthInfo,
  Pairing,
  PairingCode,
} from '@mes-courses/sync-core';
import { err, ok, type Result } from '../../domain/result';
import type {
  Connection,
  SyncFailure,
  SyncServer,
} from '../../application/ports/sync-server';

/** A request that gets no answer within this time counts as unreachable (research R9). */
export const REQUEST_TIMEOUT_MS = 10_000;

export type SyncServerOptions = {
  /** Sent as `X-App-Version` on every request, so the server can ask for an update. */
  appVersion: string;
  /** Replaced in tests, to simulate a TLS error or a server that never answers. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

/**
 * What the platforms say when certificate verification fails: iOS (NSURLErrorDomain "SSL error",
 * "certificate is invalid"), Android (`CertPathValidatorException`, "Trust anchor") and Node
 * ("self-signed certificate", `CERT_` codes).
 */
const TLS_ERROR =
  /ssl|tls|certificate|trust anchor|cert_|self[- ]signed|handshake/i;

type Answer =
  | { kind: 'response'; status: number; headers: Headers; body: unknown }
  | { kind: 'untrusted' }
  | { kind: 'unreachable' };

const parseBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

/**
 * The `SyncServer` over `fetch`. A TLS verification failure is reported as untrusted and never
 * retried (FR-019); any other transport failure, or a timeout, means the server is unreachable.
 */
export const createSyncServer = ({
  appVersion,
  fetch: fetchFn = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: SyncServerOptions): SyncServer => {
  const send = async (
    url: string,
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; credential?: string },
  ): Promise<Answer> => {
    const headers: Record<string, string> = { 'X-App-Version': appVersion };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.credential !== undefined) {
      headers.Authorization = `Bearer ${init.credential}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(`${url}${path}`, {
        method: init.method,
        headers,
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        signal: controller.signal,
      });
      return {
        kind: 'response',
        status: response.status,
        headers: response.headers,
        body: await parseBody(response),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return controller.signal.aborted || !TLS_ERROR.test(message)
        ? { kind: 'unreachable' }
        : { kind: 'untrusted' };
    } finally {
      clearTimeout(timer);
    }
  };

  const errorCode = (body: unknown): ErrorBody['error'] | null =>
    typeof body === 'object' && body !== null && 'error' in body
      ? (body as ErrorBody).error
      : null;

  /** The failure of an authenticated request that did not answer 2xx. */
  const syncFailure = (answer: Answer & { kind: 'response' }): SyncFailure => {
    if (answer.status === 401) return { type: 'DeviceNotAuthorized' };
    if (answer.status === 426) return { type: 'UpdateRequired' };
    return { type: 'ServerError' };
  };

  return {
    async health(url) {
      const answer = await send(url, '/v1/health', { method: 'GET' });
      if (answer.kind === 'untrusted') return err({ type: 'UntrustedServer' });
      if (answer.kind === 'unreachable' || answer.status !== 200) {
        return err({ type: 'ServerUnreachable' });
      }
      return ok(answer.body as HealthInfo);
    },

    async claim(url, code, deviceName) {
      const answer = await send(url, '/v1/pairing/claim', {
        method: 'POST',
        body: { code, deviceName },
      });
      if (answer.kind === 'untrusted') return err({ type: 'UntrustedServer' });
      if (answer.kind === 'unreachable') {
        return err({ type: 'ServerUnreachable' });
      }
      if (answer.status === 200) return ok(answer.body as Pairing);
      if (answer.status === 429) {
        const seconds = Number(answer.headers.get('Retry-After'));
        return err({
          type: 'TooManyAttempts',
          minutesToWait: Math.max(1, Math.ceil(seconds / 60)),
        });
      }
      if (answer.status === 400 && errorCode(answer.body) === 'InvalidCode') {
        return err({ type: 'InvalidCode' });
      }
      return err({ type: 'ServerUnreachable' });
    },

    async createPairingCode(
      conn: Connection,
    ): Promise<Result<PairingCode, SyncFailure>> {
      const answer = await send(conn.url, '/v1/pairing-codes', {
        method: 'POST',
        credential: conn.credential,
      });
      if (answer.kind === 'untrusted') return err({ type: 'UntrustedServer' });
      if (answer.kind === 'unreachable') return err({ type: 'Offline' });
      if (answer.status === 200) {
        // The body also carries the server's identity, which is not part of the code.
        const { code, expiresAt } = answer.body as PairingCode;
        return ok({ code, expiresAt });
      }
      return err(syncFailure(answer));
    },

    // The remaining methods follow in the stories that need them.
    sync: () => Promise.reject(new Error('SyncServer.sync is not implemented')),
    listDevices: () =>
      Promise.reject(new Error('SyncServer.listDevices is not implemented')),
    renameDevice: () =>
      Promise.reject(new Error('SyncServer.renameDevice is not implemented')),
    revokeDevice: () =>
      Promise.reject(new Error('SyncServer.revokeDevice is not implemented')),
  };
};
