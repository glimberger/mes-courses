import type { Reporter, ReportLevel } from '../../application/ports/reporter';

const SENSITIVE = /(token|secret|password|key|dsn)/i;

/** One line on standard error: `<level> <message> key=value ...`; secret-looking keys are masked. */
export const formatReportLine = (
  level: ReportLevel,
  message: string,
  context: Record<string, string> = {},
): string => {
  const fields = Object.entries(context).map(
    ([key, value]) => `${key}=${SENSITIVE.test(key) ? '[redacted]' : value}`,
  );
  return [level, message.replace(/\s*\n\s*/g, ' '), ...fields].join(' ');
};

export const createConsoleReporter = (
  write: (line: string) => void = (line) => console.error(line),
): Reporter => ({
  // The journal needs no liveness monitor: only Sentry has one.
  checkIn: () => undefined,
  report: (level, message, context) =>
    write(formatReportLine(level, message, context)),
});
