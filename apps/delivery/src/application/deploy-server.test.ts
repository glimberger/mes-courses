import { emptyInstanceState, markFailed } from '../domain/instance-state';
import type { InstanceState } from '../domain/instance-state';
import type { ServerEntry } from '../domain/manifest';
import { deployServer, type DeployServerDeps } from './deploy-server';
import {
  InMemoryChannelSource,
  InMemoryDatabaseSnapshots,
  InMemoryDiskSpace,
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
  const disk = new InMemoryDiskSpace(recorder);
  const deps: DeployServerDeps = {
    source: new InMemoryChannelSource(recorder),
    releases: new InMemoryReleaseStore(recorder),
    service: new InMemoryServiceManager(recorder),
    ports: new InMemoryPortOverride(recorder),
    health,
    snapshots: new InMemoryDatabaseSnapshots(recorder),
    disk,
    stateStore,
    reporter,
    downloadDir: '/dl',
  };
  return { recorder, stateStore, reporter, health, disk, deps };
};

describe('deployServer', () => {
  it('goes through install, switch, validation and opening in order', async () => {
    const { deps, recorder } = setup();

    const result = await deployServer(deps, 'staging', entry, running);

    expect(result.outcome).toEqual({ kind: 'succeeded' });
    expect(recorder.calls).toEqual([
      'DiskSpace.freeBytes',
      'DiskSpace.databaseBytes staging',
      `ChannelSource.downloadAsset staging ${entry.asset} /dl/${entry.asset}`,
      `ReleaseStore.install staging ${NEW} /dl/${entry.asset} ${SHA}`,
      `ReleaseStore.buildRuntime staging ${NEW} ${NIXPKGS}`,
      'StateStore.save staging',
      'ServiceManager.stop staging',
      `DatabaseSnapshots.take staging ${OLD}`,
      'StateStore.save staging',
      `ReleaseStore.activate staging ${NEW}`,
      'PortOverride.useValidationPort staging',
      'ServiceManager.start staging',
      `HealthProbe.waitForCommit 3101 ${NEW} 60000`,
      'PortOverride.usePublicPort staging',
      'ServiceManager.restart staging',
      `HealthProbe.waitForCommit 3002 ${NEW} 60000`,
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
      snapshot: null,
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

  it('records the database copy in the in-flight record once it is taken', async () => {
    const { deps, stateStore } = setup();
    let seenAtActivation: InstanceState | undefined;
    const activate = deps.releases.activate.bind(deps.releases);
    deps.releases.activate = async (environment, commit) => {
      seenAtActivation = stateStore.states.get('staging');
      return activate(environment, commit);
    };

    await deployServer(deps, 'staging', entry, running);

    expect(seenAtActivation?.inFlight?.snapshot).toBe(`copy-${OLD}`);
  });

  describe('rollback', () => {
    const rollbackCalls = (calls: string[]) =>
      calls.slice(calls.indexOf(`HealthProbe.waitForCommit 3101 ${NEW} 60000`));

    it('puts the previous release and database back when validation fails', async () => {
      const { deps, health, reporter, stateStore, recorder } = setup();
      health.results.push('unavailable');

      const result = await deployServer(deps, 'staging', entry, running);

      expect(result.outcome).toMatchObject({
        kind: 'rolled-back',
        stage: 'validating',
      });
      expect(rollbackCalls(recorder.calls)).toEqual([
        `HealthProbe.waitForCommit 3101 ${NEW} 60000`,
        'ServiceManager.stop staging',
        `DatabaseSnapshots.restore staging copy-${OLD}`,
        `ReleaseStore.activate staging ${OLD}`,
        'PortOverride.usePublicPort staging',
        'ServiceManager.start staging',
        `HealthProbe.waitForCommit 3002 ${OLD} 60000`,
        'StateStore.save staging',
      ]);
      const saved = stateStore.states.get('staging') as InstanceState;
      expect(saved).toEqual(result.state);
      expect(saved.failedCommits).toEqual([NEW]);
      expect(saved.server).toEqual({ commit: OLD, sequence: 10 });
      expect(saved.inFlight).toBeNull();
      expect(reporter.reports).toHaveLength(1);
      expect(reporter.reports[0]).toMatchObject({ level: 'error' });
      expect(reporter.reports[0]?.message).toContain('rolled back');
    });

    it('rolls back from the opening step too', async () => {
      const { deps, health } = setup();
      health.results.push('healthy', 'wrong-commit');
      const result = await deployServer(deps, 'staging', entry, running);
      expect(result.outcome).toMatchObject({
        kind: 'rolled-back',
        stage: 'opening',
      });
    });

    it('rolls back when the service cannot be started', async () => {
      const { deps, recorder } = setup();
      recorder.failNext('ServiceManager.start', new Error('exit 1'));
      const result = await deployServer(deps, 'staging', entry, running);
      expect(result.outcome).toMatchObject({
        kind: 'rolled-back',
        stage: 'switching',
      });
    });

    it('is degraded, critical, and keeps the previous server when the previous version is unhealthy too', async () => {
      const { deps, health, reporter, stateStore } = setup();
      health.results.push('unavailable', 'unavailable');

      const result = await deployServer(deps, 'staging', entry, running);

      expect(result.outcome).toMatchObject({ kind: 'degraded' });
      expect(reporter.reports).toHaveLength(1);
      expect(reporter.reports[0]).toMatchObject({ level: 'critical' });
      const saved = stateStore.states.get('staging') as InstanceState;
      expect(saved.server).toEqual({ commit: OLD, sequence: 10 });
      expect(saved.failedCommits).toEqual([NEW]);
      expect(saved.inFlight).toBeNull();
    });

    it('does not leave the service stopped when the rollback fails after the switch back', async () => {
      const { deps, health, recorder } = setup();
      health.results.push('unavailable', 'unavailable');
      await deployServer(deps, 'staging', entry, running);
      const calls = recorder.calls;
      expect(calls[calls.length - 2]).toBe('ServiceManager.start staging');
    });

    it('starts the previous release again when the rollback cannot restore the database copy', async () => {
      const { deps, health, recorder } = setup();
      health.results.push('unavailable');
      recorder.failNext('DatabaseSnapshots.restore', new Error('no space'));

      const result = await deployServer(deps, 'staging', entry, running);

      expect(result.outcome).toMatchObject({ kind: 'degraded' });
      expect(
        recorder.calls.filter((c) => c === 'ServiceManager.start staging'),
      ).toHaveLength(2);
      expect(
        recorder.calls.lastIndexOf(`ReleaseStore.activate staging ${OLD}`),
      ).toBeGreaterThan(
        recorder.calls.findIndex((c) =>
          c.startsWith('DatabaseSnapshots.restore staging'),
        ),
      );
    });

    it('is degraded on a fresh instance, which has nothing to go back to', async () => {
      const { deps, health, recorder, reporter } = setup(emptyInstanceState());
      health.results.push('unavailable');

      const result = await deployServer(
        deps,
        'staging',
        entry,
        emptyInstanceState(),
      );

      expect(result.outcome).toMatchObject({ kind: 'degraded' });
      expect(reporter.reports[0]).toMatchObject({ level: 'critical' });
      expect(
        recorder.calls.filter((c) => c.startsWith('DatabaseSnapshots.restore')),
      ).toEqual([]);
    });

    it('restores no copy when there was no database to copy', async () => {
      const { deps, health, recorder } = setup(emptyInstanceState());
      (deps.snapshots as InMemoryDatabaseSnapshots).hasDatabase = false;
      health.results.push('unavailable');
      await deployServer(deps, 'staging', entry, running);
      expect(
        recorder.calls.filter((c) => c.startsWith('DatabaseSnapshots.restore')),
      ).toEqual([]);
    });
  });

  describe('disk check', () => {
    const GIB = 1024 ** 3;

    it('fails the version before anything is downloaded or stopped when the disk is too small', async () => {
      const { deps, disk, recorder, reporter, stateStore } = setup();
      disk.free = GIB;

      const result = await deployServer(deps, 'staging', entry, running);

      expect(result.outcome).toMatchObject({ kind: 'failed' });
      expect(
        recorder.calls.filter(
          (c) =>
            c.startsWith('ChannelSource') ||
            c.startsWith('ServiceManager') ||
            c.startsWith('ReleaseStore'),
        ),
      ).toEqual([]);
      expect(stateStore.states.get('staging')?.failedCommits).toEqual([NEW]);
      expect(reporter.reports[0]).toMatchObject({ level: 'error' });
      expect(reporter.reports[0]?.message).toMatch(/1024 MiB free/);
    });

    it('counts the database size and a 1 GiB margin in what is needed', async () => {
      const { deps, disk } = setup();
      disk.database = 10 * GIB;
      disk.free = 11 * GIB;
      const tooSmall = await deployServer(deps, 'staging', entry, running);
      expect(tooSmall.outcome).toMatchObject({ kind: 'failed' });

      const again = setup();
      again.disk.database = 10 * GIB;
      again.disk.free = 13 * GIB;
      const enough = await deployServer(again.deps, 'staging', entry, running);
      expect(enough.outcome).toEqual({ kind: 'succeeded' });
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
