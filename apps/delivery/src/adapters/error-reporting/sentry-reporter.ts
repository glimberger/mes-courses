import * as Sentry from '@sentry/node';

import type {
  CheckInStatus,
  Reporter,
  ReportLevel,
} from '../../application/ports/reporter';
import { formatReportLine } from './console-reporter';

/** The part of the Sentry SDK the reporter uses, so tests never send anything. */
export interface SentryClient {
  captureEvent(event: {
    message: string;
    level: 'info' | 'error' | 'fatal';
    environment?: string;
    tags: Record<string, string>;
    fingerprint?: string[];
  }): void;
  captureCheckIn(
    checkIn: { monitorSlug: string; status: CheckInStatus },
    monitorConfig: {
      schedule: { type: 'interval'; value: number; unit: 'minute' };
      checkinMargin: number;
    },
  ): void;
  flush(timeoutMs: number): Promise<unknown>;
}

export type FlushableReporter = Reporter & { flush(): Promise<void> };

export const MONITOR_SLUG = 'mes-courses-agent';
/** A pass is expected every 2 minutes and counted missed after 30 (FR-020a). */
const MONITOR_CONFIG = {
  schedule: { type: 'interval', value: 2, unit: 'minute' },
  checkinMargin: 30,
} as const;
const FLUSH_TIMEOUT_MS = 5_000;

const SENTRY_LEVELS: Record<ReportLevel, 'info' | 'error' | 'fatal'> = {
  info: 'info',
  error: 'error',
  critical: 'fatal',
};

/**
 * Reports to Sentry (research R10) and to the journal. A success is an `info` event with one
 * fingerprint per environment, so it makes a single issue that groups the whole timeline.
 */
export const createSentryReporter = (
  client: SentryClient,
  write: (line: string) => void = (line) => console.error(line),
): FlushableReporter => ({
  report(level, message, context = {}) {
    write(formatReportLine(level, message, context));
    const { environment, ...rest } = context;
    client.captureEvent({
      message: environment ? `${environment}: ${message}` : message,
      level: SENTRY_LEVELS[level],
      ...(environment === undefined ? {} : { environment }),
      tags: { component: 'delivery-agent', ...rest },
      ...(level === 'info'
        ? { fingerprint: ['deployment-succeeded', environment ?? 'unknown'] }
        : {}),
    });
  },
  checkIn(status) {
    client.captureCheckIn(
      { monitorSlug: MONITOR_SLUG, status },
      MONITOR_CONFIG,
    );
  },
  async flush() {
    await client.flush(FLUSH_TIMEOUT_MS);
  },
});

/** The real SDK, initialized once for the process. */
export const createSentryClient = (dsn: string): SentryClient => {
  Sentry.init({ dsn });
  return {
    captureEvent: (event) => {
      Sentry.captureEvent(event);
    },
    captureCheckIn: (checkIn, monitorConfig) => {
      Sentry.captureCheckIn(checkIn, monitorConfig);
    },
    flush: (timeoutMs) => Sentry.flush(timeoutMs),
  };
};
