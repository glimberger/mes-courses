export type ReportLevel = 'info' | 'error' | 'critical';

export type CheckInStatus = 'ok' | 'error';

export interface Reporter {
  /** Ends a pass: tells the liveness monitor whether it went well (FR-020a). */
  checkIn(status: CheckInStatus): void;
  report(
    level: ReportLevel,
    message: string,
    context?: Record<string, string>,
  ): void;
}
