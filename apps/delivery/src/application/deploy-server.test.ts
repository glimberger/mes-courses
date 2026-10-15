import { emptyInstanceState, markFailed } from '../domain/instance-state';
import type { InstanceState } from '../domain/instance-state';
import type { ServerEntry } from '../domain/manifest';
import { deployServer, type DeployServerDeps } from './deploy-server';
import {
  InMemoryChannelSource,
  InMemoryDatabaseSnapshots,
  InMemoryPortOverride,
  InMemoryReleaseStore,
  InMemoryReporter,
  InMemoryServiceManager,
  InMemoryStateStore,
  ScriptedHealthProbe,
} from './testing/in-memory-doubles';
import { Recorder } from './testing/recorder';

const NEW = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const SHA = 'c'.repeat(64);
const NIXPKGS = 'd'.repeat(40);

const entry: ServerEntry = {
  commit: NEW,
  sequence: 20,
  version: '1.2.0-staging.20',
  asset: `server-${NEW}.tar.gz`,
  sha256: SHA,
  nixpkgsRev: NIXPKGS,
};

const running: InstanceState = {
  ...emptyInstanceState(),
  server: { commit: OLD, sequence: 10 },
};

const setup = (state: InstanceState = running) => {
  const recorder = new Recorder();
  const stateStore = new InMemoryStateStore(recorder);
  stateStore.states.set('staging', state);
  const reporter = new InMemoryReporter();
  const health = new ScriptedHealthProbe(recorder);
  const deps: DeployServerDeps = {
    source: new InMemoryChannelSource(recorder),
    releases: new InMemoryReleaseStore(recorder),
    service: new InMemoryServiceManager(recorder),
    ports: new InMemoryPortOverride(recorder),
    health,
    snapshots: new InMemoryDatabaseSnapshots(recorder),
    stateStore,
    reporter,
    downloadDir: '/dl',
  };
  return { recorder, stateStore, reporter, health, deps };
};

describe('deployServer', () => {
  it('goes through install, switch, validation and opening in order', async () => {
    const { deps, recorder } = setup();

    const result = await deployServer(deps, 'staging', entry, running);

    expect(result.outcome).toEqual({ kind: 'succeeded' });
    expect(recorder.calls).toEqual([
      `ChannelSource.downloadAsset staging ${entry.asset} /dl/${entry.asset}`,
      `ReleaseStore.install staging ${NEW} /dl/${entry.asset} ${SHA}`,
      `ReleaseStore.buildRuntime staging ${NEW} ${NIXPKGS}`,
      'StateStore.save staging',
      'ServiceManager.stop staging',
      `DatabaseSnapshots.take staging ${OLD}`,
      `ReleaseStore.activate staging ${NEW}`,
      'PortOverride.useValidationPort staging',
      'ServiceManager.start staging',
      `HealthProbe.waitForCommit 3101 ${NEW} 60000`,
      'PortOverride.usePublicPort staging',
      'ServiceManager.restart staging',
      `HealthProbe.waitForCommit 3001 ${NEW} 60000`,
      'StateStore.save staging',
      'ReleaseStore.prune staging',
    ]);
  });

  it('records the in-flight deployment before it stops the service', async () => {
    const { deps, stateStore } = setup();
    let seenBeforeStop: InstanceState | undefined;
    const stop = deps.service.stop.bind(deps.service);
    deps.service.stop = async (environment) => {
      seenBeforeStop = stateStore.states.get('staging');
      return stop(environment);
    };

    await deployServer(deps, 'staging', entry, running);

    expect(seenBeforeStop?.inFlight).toEqual({
      commit: NEW,
      previousCommit: OLD,
    });
  });

  it('saves the new server, keeps the previous one and clears the in-flight record', async () => {
    const { deps, stateStore, reporter } = setup();

    const result = await deployServer(deps, 'staging', entry, running);

    const saved = stateStore.states.get('staging');
    expect(saved).toEqual(result.state);
    expect(saved?.server).toEqual({ commit: NEW, sequence: 20 });
    expect(saved?.previousServer).toEqual({ commit: OLD, sequence: 10 });
    expect(saved?.inFlight).toBeNull();
    expect(reporter.reports.map((r) => r.level)).toEqual(['info']);
  });

  it('never lets a phone reach the new version before it is validated', async () => {
    const { deps, recorder } = setup();
    await deployServer(deps, 'staging', entry, running);
    const calls = recorder.calls;
    const validation = calls.indexOf('PortOverride.useValidationPort staging');
    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(
      calls.indexOf('ServiceManager.start staging'),
    );
    expect(calls.indexOf('PortOverride.usePublicPort staging')).toBeGreaterThan(
      calls.indexOf(`HealthProbe.waitForCommit 3101 ${NEW} 60000`),
    );
  });

  it('skips a commit that already failed here, touching nothing', async () => {
    const state = markFailed(running, NEW);
    const { deps, recorder, reporter } = setup(state);
    const result = await deployServer(deps, 'staging', entry, state);
    expect(result.outcome).toEqual({
      kind: 'skipped',
      reason: 'failed-before',
    });
    expect(recorder.calls).toEqual([]);
    expect(reporter.reports).toEqual([]);
  });

  it('skips a server that is not newer than the one in service', async () => {
    const { deps, recorder } = setup();
    const result = await deployServer(
      deps,
      'staging',
      { ...entry, sequence: 10 },
      running,
    );
    expect(result.outcome).toEqual({ kind: 'skipped', reason: 'not-newer' });
    expect(recorder.calls).toEqual([]);
  });

  it.each(['downloadAsset', 'install', 'buildRuntime'])(
    'a %s failure leaves the service untouched and marks the commit failed',
    async (method) => {
      const { deps, recorder, stateStore, reporter } = setup();
      const failing = {
        downloadAsset: 'ChannelSource.downloadAsset',
        install: 'ReleaseStore.install',
        buildRuntime: 'ReleaseStore.buildRuntime',
      }[method] as string;
      recorder.failNext(failing, new Error('disk full'));

      const result = await deployServer(deps, 'staging', entry, running);

      expect(result.outcome).toMatchObject({ kind: 'failed' });
      expect(
        recorder.calls.filter((c) => c.startsWith('ServiceManager')),
      ).toEqual([]);
      expect(stateStore.states.get('staging')?.failedCommits).toEqual([NEW]);
      expect(stateStore.states.get('staging')?.server?.commit).toBe(OLD);
      expect(reporter.reports).toHaveLength(1);
      expect(reporter.reports[0]).toMatchObject({ level: 'error' });
      expect(reporter.reports[0]?.message).toContain('disk full');
    },
  );

  it('reports a critical error when the new version is not healthy after the stop', async () => {
    const { deps, health, reporter, stateStore } = setup();
    health.results.push('unavailable');

    const result = await deployServer(deps, 'staging', entry, running);

    expect(result.outcome).toMatchObject({
      kind: 'unhandled',
      stage: 'validating',
    });
    expect(reporter.reports).toHaveLength(1);
    expect(reporter.reports[0]).toMatchObject({ level: 'critical' });
    const saved = stateStore.states.get('staging');
    expect(saved?.failedCommits).toEqual([NEW]);
    expect(saved?.inFlight).not.toBeNull();
  });

  it('is unhandled in the opening step when the public port does not answer', async () => {
    const { deps, health } = setup();
    health.results.push('healthy', 'wrong-commit');
    const result = await deployServer(deps, 'staging', entry, running);
    expect(result.outcome).toMatchObject({
      kind: 'unhandled',
      stage: 'opening',
    });
  });

  it('is unhandled in the switching step when the service cannot be started', async () => {
    const { deps, recorder } = setup();
    recorder.failNext('ServiceManager.start', new Error('exit 1'));
    const result = await deployServer(deps, 'staging', entry, running);
    expect(result.outcome).toMatchObject({
      kind: 'unhandled',
      stage: 'switching',
    });
  });

  it('deploys on a fresh instance with no previous release', async () => {
    const { deps, recorder } = setup(emptyInstanceState());
    const result = await deployServer(
      deps,
      'staging',
      entry,
      emptyInstanceState(),
    );
    expect(result.outcome).toEqual({ kind: 'succeeded' });
    expect(recorder.calls).toContain('DatabaseSnapshots.take staging null');
    expect(result.state.previousServer).toBeNull();
  });
});
