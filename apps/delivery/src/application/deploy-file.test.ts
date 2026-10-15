import { emptyInstanceState } from '../domain/instance-state';
import { deployFile, type DeployFileDeps } from './deploy-file';
import {
  FakeSigner,
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
const FILE = `/tmp/server-${NEW}.tar.gz`;

const setup = () => {
  const recorder = new Recorder();
  const stateStore = new InMemoryStateStore(recorder);
  stateStore.states.set('staging', {
    ...emptyInstanceState(),
    server: { commit: OLD, sequence: 10 },
  });
  const health = new ScriptedHealthProbe(recorder);
  const verifier = new FakeSigner(recorder);
  const deps: DeployFileDeps = {
    releases: new InMemoryReleaseStore(recorder),
    service: new InMemoryServiceManager(recorder),
    ports: new InMemoryPortOverride(recorder),
    health,
    snapshots: new InMemoryDatabaseSnapshots(recorder),
    disk: new InMemoryDiskSpace(recorder),
    stateStore,
    reporter: new InMemoryReporter(),
    downloadDir: '/dl',
    hashFile: async () => 'c'.repeat(64),
  };
  return { recorder, stateStore, health, deps, verifier };
};

describe('deployFile', () => {
  it('installs the local archive and goes through the same validation', async () => {
    const { deps, recorder, stateStore } = setup();

    const outcome = await deployFile(deps, 'staging', FILE);

    expect(outcome).toEqual({ kind: 'succeeded' });
    expect(recorder.calls).toContain(
      `ReleaseStore.install staging ${NEW} ${FILE} ${'c'.repeat(64)}`,
    );
    expect(stateStore.states.get('staging')?.server).toEqual({
      commit: NEW,
      sequence: 10,
    });
  });

  it('never reads the channel source or the signature verifier', async () => {
    const { deps, recorder } = setup();
    await deployFile(deps, 'staging', FILE);
    expect(
      recorder.calls.filter(
        (c) =>
          c.startsWith('ChannelSource') || c.startsWith('SignatureVerifier'),
      ),
    ).toEqual([]);
  });

  it('rolls back when the new version fails its health check', async () => {
    const { deps, health, stateStore } = setup();
    health.results.push('unavailable');

    const outcome = await deployFile(deps, 'staging', FILE);

    expect(outcome).toMatchObject({ kind: 'rolled-back' });
    const state = stateStore.states.get('staging');
    expect(state?.server?.commit).toBe(OLD);
    expect(state?.failedCommits).toEqual([NEW]);
  });

  it('refuses a file that does not carry its commit in its name', async () => {
    const { deps, recorder } = setup();
    await expect(
      deployFile(deps, 'staging', '/tmp/server.tar.gz'),
    ).rejects.toThrow(/server-<40 hex>/);
    expect(recorder.calls).toEqual([]);
  });
});
