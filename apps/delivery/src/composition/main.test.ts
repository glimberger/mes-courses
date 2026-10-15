import { exitCodeOf, parseAgentArgs } from './main';

describe('parseAgentArgs', () => {
  it('runs over both environments by default', () => {
    expect(parseAgentArgs(['run'])).toEqual({ command: 'run' });
  });

  it('runs over one environment with --only', () => {
    expect(parseAgentArgs(['run', '--only', 'production'])).toEqual({
      command: 'run',
      only: 'production',
    });
  });

  it('rejects an unknown environment', () => {
    expect(() => parseAgentArgs(['run', '--only', 'qa'])).toThrow(
      /staging or production/,
    );
  });

  it('rejects --only without a value', () => {
    expect(() => parseAgentArgs(['run', '--only'])).toThrow(/--only/);
  });

  it('rejects an unknown option and an unknown command', () => {
    expect(() => parseAgentArgs(['run', '--force'])).toThrow(/--force/);
    expect(() => parseAgentArgs(['launch'])).toThrow(/command/);
    expect(() => parseAgentArgs([])).toThrow(/command/);
  });
});

describe('parseAgentArgs, delivery commands', () => {
  it('parses forget-failure and deploy-file', () => {
    expect(parseAgentArgs(['forget-failure', 'staging', 'abc'])).toEqual({
      command: 'forget-failure',
      environment: 'staging',
      sha: 'abc',
    });
    expect(
      parseAgentArgs(['deploy-file', 'production', 'server-x.tar.gz']),
    ).toEqual({
      command: 'deploy-file',
      environment: 'production',
      file: 'server-x.tar.gz',
    });
  });

  it.each([
    ['forget-failure', 'staging'],
    ['forget-failure', 'qa', 'abc'],
    ['deploy-file', 'staging', 'a', 'b'],
    ['deploy-file'],
  ])('rejects %j', (...argv) => {
    expect(() => parseAgentArgs(argv)).toThrow();
  });
});

describe('parseAgentArgs, status', () => {
  it('parses status without arguments and rejects any', () => {
    expect(parseAgentArgs(['status'])).toEqual({ command: 'status' });
    expect(() => parseAgentArgs(['status', 'staging'])).toThrow(/Usage/);
  });
});

describe('exitCodeOf', () => {
  it('is 0 unless an instance is degraded', () => {
    expect(exitCodeOf({ environments: {}, degraded: false })).toBe(0);
    expect(
      exitCodeOf({
        environments: { staging: { status: 'failed' } },
        degraded: false,
      }),
    ).toBe(0);
    expect(exitCodeOf({ environments: {}, degraded: true })).toBe(1);
  });
});
