import { createConsoleReporter, formatReportLine } from './console-reporter';

describe('console reporter', () => {
  it('writes one line with the level, the message and the context', () => {
    expect(
      formatReportLine('error', 'Deployment failed', {
        environment: 'staging',
        commit: 'abc',
      }),
    ).toBe('error Deployment failed environment=staging commit=abc');
  });

  it('keeps a multi-line message on one line', () => {
    expect(formatReportLine('info', 'a\nb')).toBe('info a b');
  });

  it('never prints a value whose key looks like a secret', () => {
    expect(formatReportLine('critical', 'x', { GITHUB_TOKEN: 'ghp_123' })).toBe(
      'critical x GITHUB_TOKEN=[redacted]',
    );
  });

  it('hands the line to the writer', () => {
    const lines: string[] = [];
    createConsoleReporter((line) => lines.push(line)).report('info', 'hi');
    expect(lines).toEqual(['info hi']);
  });
});
