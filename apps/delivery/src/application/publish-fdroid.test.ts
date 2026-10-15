import { emptyInstanceState } from '../domain/instance-state';
import type { InstanceState } from '../domain/instance-state';
import type { FdroidEntry } from '../domain/manifest';
import type { DeployOutcome } from './deploy-server';
import { publishFdroid, type PublishFdroidDeps } from './publish-fdroid';
import {
  InMemoryChannelSource,
  InMemoryFdroidSite,
  InMemoryReporter,
  InMemoryStateStore,
  ScriptedHealthProbe,
} from './testing/in-memory-doubles';
import { Recorder } from './testing/recorder';

const SERVER = 'a'.repeat(40);
const APP = 'b'.repeat(40);
const SHA = 'c'.repeat(64);

const entry: FdroidEntry = {
  commit: APP,
  versionCode: 30,
  asset: `fdroid-staging-${APP}.tar.gz`,
  sha256: SHA,
};

const serving: InstanceState = {
  ...emptyInstanceState(),
  server: { commit: SERVER, sequence: 20 },
};

const setup = (state: InstanceState = serving) => {
  const recorder = new Recorder();
  const stateStore = new InMemoryStateStore(recorder);
  stateStore.states.set('staging', state);
  const health = new ScriptedHealthProbe(recorder);
  const reporter = new InMemoryReporter();
  const deps: PublishFdroidDeps = {
    source: new InMemoryChannelSource(recorder),
    site: new InMemoryFdroidSite(recorder),
    health,
    stateStore,
    reporter,
    downloadDir: '/dl',
  };
  return { recorder, stateStore, health, reporter, deps };
};

const succeeded: DeployOutcome = { kind: 'succeeded' };

describe('publishFdroid', () => {
  it('downloads, swaps the repository and stores the entry, after a deployed server', async () => {
    const { deps, recorder, stateStore } = setup();

    const result = await publishFdroid(
      deps,
      'staging',
      entry,
      serving,
      succeeded,
    );

    expect(result.published).toBe(true);
    expect(recorder.calls).toEqual([
      `HealthProbe.waitForCommit 3002 ${SERVER} 10000`,
      `ChannelSource.downloadAsset staging ${entry.asset} /dl/${entry.asset}`,
      `FdroidSite.publish staging ${APP} /dl/${entry.asset} ${SHA}`,
      'StateStore.save staging',
    ]);
    expect(stateStore.states.get('staging')?.fdroid).toEqual({
      commit: APP,
      versionCode: 30,
    });
  });

  it('does nothing when the manifest has no F-Droid entry', async () => {
    const { deps, recorder } = setup();
    const result = await publishFdroid(
      deps,
      'staging',
      null,
      serving,
      succeeded,
    );
    expect(result.published).toBe(false);
    expect(result.pending).toBe(false);
    expect(recorder.calls).toEqual([]);
  });

  it('does nothing when that repository is already served', async () => {
    const state = { ...serving, fdroid: { commit: APP, versionCode: 30 } };
    const { deps, recorder } = setup(state);
    const result = await publishFdroid(
      deps,
      'staging',
      entry,
      state,
      succeeded,
    );
    expect(result.published).toBe(false);
    expect(recorder.calls).toEqual([]);
  });

  it.each<DeployOutcome>([
    { kind: 'failed', error: 'x' },
    { kind: 'rolled-back', stage: 'validating', error: 'x' },
    { kind: 'degraded', stage: 'opening', error: 'x' },
  ])('skips the swap when the server step ended %j', async (outcome) => {
    const { deps, recorder } = setup();
    const result = await publishFdroid(
      deps,
      'staging',
      entry,
      serving,
      outcome,
    );
    expect(result.published).toBe(false);
    expect(recorder.calls).toEqual([]);
  });

  it.each<DeployOutcome>([
    { kind: 'skipped', reason: 'not-newer' },
    { kind: 'skipped', reason: 'failed-before' },
  ])(
    'runs when the server entry was skipped (%j) and the server in service is healthy',
    async (outcome) => {
      const { deps } = setup();
      const result = await publishFdroid(
        deps,
        'staging',
        entry,
        serving,
        outcome,
      );
      expect(result.published).toBe(true);
    },
  );

  it('ignores a failed server commit carried over by an app-only release', async () => {
    // The manifest's server entry is a commit that failed here: the instance still serves
    // SERVER, healthy, so the app repository is published.
    const state: InstanceState = {
      ...serving,
      failedCommits: ['f'.repeat(40)],
    };
    const { deps } = setup(state);
    const result = await publishFdroid(deps, 'staging', entry, state, {
      kind: 'skipped',
      reason: 'failed-before',
    });
    expect(result.published).toBe(true);
  });

  it('skips the swap when the server in service is not healthy', async () => {
    const { deps, health, recorder } = setup();
    health.results.push('unavailable');
    const result = await publishFdroid(
      deps,
      'staging',
      entry,
      serving,
      succeeded,
    );
    expect(result.published).toBe(false);
    expect(result.pending).toBe(true);
    expect(recorder.calls.some((c) => c.includes('FdroidSite'))).toBe(false);
  });

  it('skips the swap when no server is in service', async () => {
    const { deps } = setup(emptyInstanceState());
    const result = await publishFdroid(
      deps,
      'staging',
      entry,
      emptyInstanceState(),
      { kind: 'skipped', reason: 'not-newer' },
    );
    expect(result.published).toBe(false);
    expect(result.pending).toBe(true);
  });

  it('reports an error and keeps the old repository when the download fails', async () => {
    const { deps, recorder, reporter, stateStore } = setup();
    recorder.failNext('ChannelSource.downloadAsset', new Error('timeout'));

    const result = await publishFdroid(
      deps,
      'staging',
      entry,
      serving,
      succeeded,
    );

    expect(result).toMatchObject({ published: false, failed: true });
    expect(reporter.reports[0]).toMatchObject({ level: 'error' });
    expect(stateStore.states.get('staging')?.fdroid).toBeNull();
  });
});
