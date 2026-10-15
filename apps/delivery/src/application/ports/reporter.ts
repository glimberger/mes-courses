export type ReportLevel = 'info' | 'error' | 'critical';

export interface Reporter {
  report(
    level: ReportLevel,
    message: string,
    context?: Record<string, string>,
  ): void;
}
