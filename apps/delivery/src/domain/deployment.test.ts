import { advance, decideDeployment } from './deployment';
import { emptyInstanceState, markFailed } from './instance-state';
import type { ServerEntry } from './manifest';

const entry = (commit: string, sequence: number): ServerEntry => ({
  commit,
  sequence,
  version: '1.0.0',
  asset: 'server.tar.gz',
  sha256: 'a'.repeat(64),
  nixpkgsRev: 'b'.repeat(40),
});

describe('advance', () => {
  it('follows the diagram, step by step', () => {
    let status = advance('idle', 'installing');
    status = advance(status, 'switching');
    status = advance(status, 'validating');
    status = advance(status, 'opening');
    expect(advance(status, 'succeeded')).toBe('succeeded');
  });

  it.each(['switching', 'validating', 'opening'] as const)(
    'rolls back from %s, then ends rolled-back or degraded',
    (from) => {
      const rolling = advance(from, 'rolling-back');
      expect(advance(rolling, 'rolled-back')).toBe('rolled-back');
      expect(advance(rolling, 'degraded')).toBe('degraded');
    },
  );

  it('starts at rolling-back when a pass finds a deployment in flight', () => {
    expect(advance('idle', 'rolling-back')).toBe('rolling-back');
  });

  it.each([
    ['installing', 'rolling-back'],
    ['rolling-back', 'succeeded'],
    ['rolled-back', 'installing'],
    ['degraded', 'rolling-back'],
  ] as const)('refuses %s to %s', (from, to) => {
    expect(() => advance(from, to)).toThrow(/cannot go/);
  });

  it('ends failed when the install fails', () => {
    expect(advance('installing', 'failed')).toBe('failed');
  });

  it.each([
    ['idle', 'switching'],
    ['switching', 'opening'],
    ['validating', 'succeeded'],
    ['switching', 'failed'],
    ['succeeded', 'installing'],
  ] as const)('refuses %s to %s', (from, to) => {
    expect(() => advance(from, to)).toThrow(/cannot go/);
  });
});

describe('decideDeployment', () => {
  it('deploys on a fresh instance', () => {
    expect(decideDeployment(emptyInstanceState(), entry('a', 5))).toEqual({
      deploy: true,
    });
  });

  it('deploys a newer server', () => {
    const state = {
      ...emptyInstanceState(),
      server: { commit: 'old', sequence: 4 },
    };
    expect(decideDeployment(state, entry('a', 5))).toEqual({ deploy: true });
  });

  it.each([4, 5])(
    'skips a server with sequence %i, not newer than 5',
    (sequence) => {
      const state = {
        ...emptyInstanceState(),
        server: { commit: 'cur', sequence: 5 },
      };
      expect(decideDeployment(state, entry('a', sequence))).toEqual({
        deploy: false,
        reason: 'not-newer',
      });
    },
  );

  it('skips a commit that failed here', () => {
    const state = markFailed(emptyInstanceState(), 'a');
    expect(decideDeployment(state, entry('a', 9))).toEqual({
      deploy: false,
      reason: 'failed-before',
    });
  });
});

describe('decideDeployment with the commit already in service', () => {
  it('skips the commit in service, whatever its sequence', () => {
    const state = {
      ...emptyInstanceState(),
      server: { commit: 'cur', sequence: 0 },
    };
    expect(decideDeployment(state, entry('cur', 9))).toEqual({
      deploy: false,
      reason: 'not-newer',
    });
  });
});
