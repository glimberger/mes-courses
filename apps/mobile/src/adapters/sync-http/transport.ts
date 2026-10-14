import type { ErrorBody } from '@mes-courses/sync-core';
import { err, type Result } from '../../domain/result';
import type { SyncFailure } from '../../application/ports/sync-server';

/** A request that gets no answer within this time counts as unreachable (research R9). */
export const REQUEST_TIMEOUT_MS = 10_000;

export type TransportOptions = {
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
  /\b(?:ssl|tls)\b|certificate|trust anchor|\bcert_|self[- ]signed|handshake/i;

/**
 * What a reverse proxy answers when the server behind it is down or not answering: the same as
 * no answer at all (FR-003).
 */
const PROXY_UNREACHABLE = new Set([502, 503, 504]);

export type Answer =
  | { kind: 'response'; status: number; headers: Headers; body: unknown }
  | { kind: 'untrusted' }
  | { kind: 'unreachable' };

export type RequestInit = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  credential?: string;
};

export type Send = (
  url: string,
  path: string,
  init: RequestInit,
) => Promise<Answer>;

const parseBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

/**
 * The HTTP transport shared by the server adapters. A TLS verification failure is reported as
 * untrusted and never retried (FR-019); any other transport failure, or a timeout, means the
 * server is unreachable.
 */
export const createSend =
  ({
    appVersion,
    fetch: fetchFn = fetch,
    timeoutMs = REQUEST_TIMEOUT_MS,
  }: TransportOptions): Send =>
  async (url, path, init) => {
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
      if (PROXY_UNREACHABLE.has(response.status))
        return { kind: 'unreachable' };
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

export const errorCode = (body: unknown): ErrorBody['error'] | null =>
  typeof body === 'object' && body !== null && 'error' in body
    ? (body as ErrorBody).error
    : null;

/** The failure of an authenticated request that did not answer 2xx. */
export const syncFailure = (
  answer: Answer & { kind: 'response' },
): SyncFailure => {
  const code = errorCode(answer.body);
  if (answer.status === 401) {
    return code === 'AccountDeleted'
      ? { type: 'AccountDeleted' }
      : { type: 'DeviceNotAuthorized' };
  }
  if (answer.status === 403 && code === 'AccountSuspended') {
    return { type: 'AccountSuspended' };
  }
  if (answer.status === 426) return { type: 'UpdateRequired' };
  return { type: 'ServerError' };
};

export const transportFailure = (
  answer: Exclude<Answer, { kind: 'response' }>,
): Result<never, SyncFailure> =>
  err({ type: answer.kind === 'untrusted' ? 'UntrustedServer' : 'Offline' });

/** `Retry-After` in seconds; an HTTP-date or a missing header gives a 1 minute wait. */
export const minutesToWait = (header: string | null): number => {
  const seconds = header === null ? NaN : Number(header);
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds / 60)) : 1;
};
