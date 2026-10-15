import { emptyInstanceState } from '../domain/instance-state';
import type { InstanceState } from '../domain/instance-state';
import type { ChannelManifest, Environment } from '../domain/manifest';
import { ChannelSourceError } from './ports/channel-source';
import { runAgent, type RunAgentDeps } from './run-agent';
import {
  FakeClock,
  FakeSigner,
  InMemoryChannelSource,
  InMemoryDatabaseSnapshots,
  InMemoryFdroidSite,
  InMemoryPortOverride,
  InMemoryReleaseStore,
  InMemoryReporter,
  InMemoryServiceManager,
  InMemoryStateStore,
  ScriptedHealthProbe,
} from './testing/in-memory-doubles';
import { Recorder } from './testing/recorder';

const commit = (c: string) => c.repeat(40);

const manifestFor = (
  environment: Environment,
  change: Partial<ChannelManifest> = {},
): ChannelManifest => ({
  schema: 1,
  environment,
  sequence: 30,
  commit: commit('e'),
  version: environment === 'staging' ? '1.2.0-staging.30' : '1.2.0',
  createdAt: '2026-10-20T08:00:00.000Z',
  run: { id: 1, url: 'https://github.com/o/r/actions/runs/1' },
  minAgentVersion: '1.0.0',
  server: {
    commit: commit('e'),
    sequence: 30,
    version: environment === 'staging' ? '1.2.0-staging.30' : '1.2.0',
    asset: `server-${commit('e')}.tar.gz`,
    sha256: 'f'.repeat(64),
    nixpkgsRev: '1'.repeat(40),
  },
  fdroid: null,
  ...change,
});

const setup = (agentVersion = '1.0.0') => {
  const recorder = new Recorder();
  const source = new InMemoryChannelSource(recorder);
  const stateStore = new InMemoryStateStore(recorder);
  const reporter = new InMemoryReporter();
  const signer = new FakeSigner(recorder);
  const clock = new FakeClock();
  const health = new ScriptedHealthProbe(recorder);
  const deps: RunAgentDeps = {
    source,
    verifier: signer,
    releases: new InMemoryReleaseStore(recorder),
    service: new InMemoryServiceManager(recorder),
    ports: new InMemoryPortOverride(recorder),
    health,
    snapshots: new InMemoryDatabaseSnapshots(recorder),
    site: new InMemoryFdroidSite(recorder),
    stateStore,
    reporter,
    clock,
    downloadDir: '/dl',
    agentVersion,
  };
  const publish = (environment: Environment, manifest: ChannelManifest) => {
    const json = JSON.stringify(manifest);
    source.channels.set(environment, {
      manifest: json,
      signature: `signed:${json}`,
    });
  };
  return { recorder, source, stateStore, reporter, health, deps, publish };
};

const deployedCalls = (recorder: Recorder, environment: Environment) =>
  recorder.calls.filter(
    (c) => c.startsWith('ServiceManager.stop') && c.endsWith(environment),
  );

describe('runAgent', () => {
  it('handles staging, then production, one after the other', async () => {
    const { deps, publish, recorder } = setup();
    publish('staging', manifestFor('staging'));
    publish('production', manifestFor('production'));

    await runAgent(deps);

    const stops = recorder.calls.filter((c) =>
      c.startsWith('ServiceManager.stop'),
    );
    expect(stops).toEqual([
      'ServiceManager.stop staging',
      'ServiceManager.stop production',
    ]);
  });

  it('handles one environment with --only', async () => {
    const { deps, publish, recorder } = setup();
    publish('staging', manifestFor('staging'));
    publish('production', manifestFor('production'));

    await runAgent(deps, { only: 'production' });

    expect(deployedCalls(recorder, 'staging')).toEqual([]);
    expect(deployedCalls(recorder, 'production')).toHaveLength(1);
  });

  it('keeps going with production when staging fails', async () => {
    const { deps, publish, recorder, reporter } = setup();
    publish('staging', manifestFor('staging'));
    publish('production', manifestFor('production'));
    recorder.failNext('ChannelSource.downloadAsset', new Error('network down'));

    const result = await runAgent(deps);

    expect(result.environments.staging).toMatchObject({ status: 'failed' });
    expect(result.environments.production).toMatchObject({
      status: 'deployed',
    });
    expect(reporter.reports.some((r) => r.level === 'error')).toBe(true);
  });

  it('survives an unexpected exception in staging', async () => {
    const { deps, publish, recorder } = setup();
    publish('staging', manifestFor('staging'));
    publish('production', manifestFor('production'));
    recorder.failNext('StateStore.load', new Error('disk unreadable'));

    const result = await runAgent(deps);

    expect(result.environments.staging).toMatchObject({ status: 'error' });
    expect(result.environments.production).toMatchObject({
      status: 'deployed',
    });
  });

  it('advances the manifest sequence and records the fetch after a full success', async () => {
    const { deps, publish, stateStore } = setup();
    publish('staging', manifestFor('staging'));

    await runAgent(deps, { only: 'staging' });

    const state = stateStore.states.get('staging') as InstanceState;
    expect(state.manifestSequence).toBe(30);
    expect(state.lastFetchSuccessAt).toBe('2026-10-20T08:00:00.000Z');
    expect(state.server).toEqual({ commit: commit('e'), sequence: 30 });
  });

  it('is a no-op for a manifest that is not newer than the last handled one', async () => {
    const { deps, publish, stateStore, recorder } = setup();
    stateStore.states.set('staging', {
      ...emptyInstanceState(),
      manifestSequence: 30,
    });
    publish('staging', manifestFor('staging'));

    const result = await runAgent(deps, { only: 'staging' });

    expect(result.environments.staging).toMatchObject({ status: 'unchanged' });
    expect(deployedCalls(recorder, 'staging')).toEqual([]);
  });

  it('changes nothing when the same commit is delivered twice', async () => {
    const { deps, publish, recorder } = setup();
    publish('staging', manifestFor('staging'));
    await runAgent(deps, { only: 'staging' });
    const stopsAfterFirst = deployedCalls(recorder, 'staging').length;

    await runAgent(deps, { only: 'staging' });

    expect(deployedCalls(recorder, 'staging')).toHaveLength(stopsAfterFirst);
  });

  it('does nothing when the channel does not exist yet', async () => {
    const { deps, reporter } = setup();
    const result = await runAgent(deps, { only: 'staging' });
    expect(result.environments.staging).toMatchObject({ status: 'no-channel' });
    expect(reporter.reports).toEqual([]);
  });

  describe('refusals', () => {
    it('refuses a manifest whose signature does not verify, silently at first', async () => {
      const { deps, source, reporter, recorder, stateStore } = setup();
      source.channels.set('staging', {
        manifest: JSON.stringify(manifestFor('staging')),
        signature: 'forged',
      });

      const result = await runAgent(deps, { only: 'staging' });

      expect(result.environments.staging).toMatchObject({ status: 'refused' });
      expect(deployedCalls(recorder, 'staging')).toEqual([]);
      expect(reporter.reports).toEqual([]);
      expect(stateStore.states.get('staging')?.signatureMismatches).toBe(1);
    });

    it('reports a signature mismatch only after it persisted for three passes', async () => {
      const { deps, source, reporter } = setup();
      source.channels.set('staging', {
        manifest: JSON.stringify(manifestFor('staging')),
        signature: 'forged',
      });

      await runAgent(deps, { only: 'staging' });
      await runAgent(deps, { only: 'staging' });
      expect(reporter.reports).toEqual([]);
      await runAgent(deps, { only: 'staging' });

      expect(reporter.reports).toHaveLength(1);
      expect(reporter.reports[0]).toMatchObject({ level: 'error' });
      expect(reporter.reports[0]?.message).toMatch(/signature/i);
    });

    it('forgets earlier mismatches once a manifest verifies', async () => {
      const { deps, publish, source, stateStore } = setup();
      source.channels.set('staging', {
        manifest: JSON.stringify(manifestFor('staging')),
        signature: 'forged',
      });
      await runAgent(deps, { only: 'staging' });
      publish('staging', manifestFor('staging'));

      await runAgent(deps, { only: 'staging' });

      expect(stateStore.states.get('staging')?.signatureMismatches).toBe(0);
    });

    it('refuses an invalid manifest and reports it', async () => {
      const { deps, source, reporter, recorder } = setup();
      const json = JSON.stringify({ schema: 2 });
      source.channels.set('staging', {
        manifest: json,
        signature: `signed:${json}`,
      });

      const result = await runAgent(deps, { only: 'staging' });

      expect(result.environments.staging).toMatchObject({ status: 'refused' });
      expect(reporter.reports[0]).toMatchObject({ level: 'error' });
      expect(deployedCalls(recorder, 'staging')).toEqual([]);
    });

    it('refuses a manifest read from the wrong channel', async () => {
      const { deps, publish, reporter, recorder } = setup();
      publish('staging', manifestFor('production'));

      const result = await runAgent(deps, { only: 'staging' });

      expect(result.environments.staging).toMatchObject({ status: 'refused' });
      expect(reporter.reports[0]?.message).toMatch(/environment/i);
      expect(deployedCalls(recorder, 'staging')).toEqual([]);
    });

    it('refuses a manifest that needs a newer agent', async () => {
      const { deps, publish, reporter, recorder } = setup('1.0.0');
      publish('staging', manifestFor('staging', { minAgentVersion: '1.1.0' }));

      const result = await runAgent(deps, { only: 'staging' });

      expect(result.environments.staging).toMatchObject({ status: 'refused' });
      expect(reporter.reports[0]?.message).toMatch(/agent/i);
      expect(deployedCalls(recorder, 'staging')).toEqual([]);
    });

    it('reports a token problem (401) as an error and deploys nothing', async () => {
      const { deps, recorder, reporter } = setup();
      recorder.failNext(
        'ChannelSource.fetchChannel',
        new ChannelSourceError('GitHub answered 401', 401),
      );

      const result = await runAgent(deps, { only: 'staging' });

      expect(result.environments.staging).toMatchObject({
        status: 'fetch-failed',
      });
      expect(reporter.reports[0]).toMatchObject({ level: 'error' });
    });
  });

  describe('failures', () => {
    it('does not advance the manifest sequence when the server deployment failed', async () => {
      const { deps, publish, recorder, stateStore } = setup();
      publish('staging', manifestFor('staging'));
      recorder.failNext('ReleaseStore.install', new Error('bad archive'));

      await runAgent(deps, { only: 'staging' });

      const state = stateStore.states.get('staging') as InstanceState;
      expect(state.manifestSequence).toBeNull();
      expect(state.failedCommits).toEqual([commit('e')]);
    });

    it('reports degraded when a deployment failed after the stop', async () => {
      const { deps, publish, health } = setup();
      publish('staging', manifestFor('staging'));
      health.results.push('unavailable');

      const result = await runAgent(deps, { only: 'staging' });

      expect(result.degraded).toBe(true);
    });

    it('does not retry a failed commit but handles the next manifest', async () => {
      const { deps, publish, recorder, stateStore } = setup();
      publish('staging', manifestFor('staging'));
      recorder.failNext('ReleaseStore.install', new Error('bad archive'));
      await runAgent(deps, { only: 'staging' });
      const stops = deployedCalls(recorder, 'staging').length;

      await runAgent(deps, { only: 'staging' });
      expect(deployedCalls(recorder, 'staging')).toHaveLength(stops);

      const next = commit('9');
      publish(
        'staging',
        manifestFor('staging', {
          sequence: 31,
          commit: next,
          version: '1.2.0-staging.31',
          server: {
            ...manifestFor('staging').server,
            commit: next,
            sequence: 31,
            version: '1.2.0-staging.31',
            asset: `server-${next}.tar.gz`,
          },
        }),
      );
      await runAgent(deps, { only: 'staging' });

      expect(stateStore.states.get('staging')?.server?.commit).toBe(next);
    });
  });

  describe('the Android repository', () => {
    const withFdroid = (environment: Environment = 'staging') =>
      manifestFor(environment, {
        fdroid: {
          commit: commit('e'),
          versionCode: 30,
          asset: `fdroid-${environment}-${commit('e')}.tar.gz`,
          sha256: '2'.repeat(64),
        },
      });

    it('is published after the server is deployed', async () => {
      const { deps, publish, recorder, stateStore } = setup();
      publish('staging', withFdroid());

      await runAgent(deps, { only: 'staging' });

      expect(
        recorder.calls.some((c) => c.startsWith('FdroidSite.publish')),
      ).toBe(true);
      expect(stateStore.states.get('staging')?.fdroid).toEqual({
        commit: commit('e'),
        versionCode: 30,
      });
    });

    it('is not published when the server deployment failed', async () => {
      const { deps, publish, recorder } = setup();
      publish('staging', withFdroid());
      recorder.failNext('ReleaseStore.install', new Error('bad archive'));

      await runAgent(deps, { only: 'staging' });

      expect(
        recorder.calls.some((c) => c.startsWith('FdroidSite.publish')),
      ).toBe(false);
    });
  });
});
