import {
  emptyInstanceState,
  markFailed,
  recordSuccess,
} from '../domain/instance-state';
import { showStatus } from './show-status';
import {
  InMemoryStateStore,
  ScriptedHealthProbe,
} from './testing/in-memory-doubles';

const deliveredState = (commit: string) => ({
  ...recordSuccess(emptyInstanceState(), { commit, sequence: 7 }),
  fdroid: { commit, versionCode: 7 },
  lastFetchSuccessAt: '2026-10-15T10:00:00.000Z',
});

describe('showStatus', () => {
  it('reports a fresh instance without probing a commit it does not have', async () => {
    const stateStore = new InMemoryStateStore();
    const health = new ScriptedHealthProbe();
    health.fallback = 'unavailable';

    const text = await showStatus({ stateStore, health });

    expect(text).toContain('staging');
    expect(text).toContain('production');
    expect(text).toContain('server: none');
    expect(text).toContain('fdroid: none');
    expect(text).toContain('last fetch: never');
    expect(text).toContain('health: unavailable');
  });

  it('lists the commits, the failed ones and the last fetch', async () => {
    const stateStore = new InMemoryStateStore();
    stateStore.states.set(
      'staging',
      markFailed(deliveredState('aaa111'), 'bad222'),
    );
    const health = new ScriptedHealthProbe();

    const text = await showStatus({ stateStore, health });

    expect(text).toContain('server: aaa111');
    expect(text).toContain('fdroid: aaa111');
    expect(text).toContain('failed: bad222');
    expect(text).toContain('last fetch: 2026-10-15T10:00:00.000Z');
    expect(text).toContain('health: healthy');
  });

  it('probes each instance on its own port for the commit it should run, once', async () => {
    const stateStore = new InMemoryStateStore();
    stateStore.states.set('staging', deliveredState('aaa111'));
    stateStore.states.set('production', deliveredState('bbb222'));
    const health = new ScriptedHealthProbe();
    health.results.push('healthy', 'wrong-commit');
    const calls: unknown[][] = [];
    const probe = {
      waitForCommit: (port: number, commit: string, timeoutMs: number) => {
        calls.push([port, commit, timeoutMs]);
        return health.waitForCommit(port, commit, timeoutMs);
      },
    };

    const text = await showStatus({ stateStore, health: probe });

    expect(calls).toEqual([
      [3001, 'aaa111', 0],
      [3000, 'bbb222', 0],
    ]);
    expect(text).toContain('health: wrong-commit');
  });

  it('says so when a state file cannot be read, and still shows the other instance', async () => {
    const stateStore = new InMemoryStateStore();
    stateStore.corrupt.add('staging');
    const health = new ScriptedHealthProbe();

    const text = await showStatus({ stateStore, health });

    expect(text).toContain('state unreadable');
    expect(text).toContain('production');
  });
});
