import type {
  AgentHost,
  AgentRelease,
  AgentReleases,
} from './ports/agent-update';
import { Recorder } from './testing/recorder';
import { updateAgent } from './update-agent';

const release: AgentRelease = {
  tag: 'v2.3.0',
  agentVersion: '1.1.0',
  assetId: 42,
  assetName: 'delivery-1.1.0.tar.gz',
};

class FakeReleases implements AgentReleases {
  constructor(private readonly recorder: Recorder) {}
  async resolve(version?: string) {
    this.recorder.record('Releases.resolve', version ?? 'latest');
    return release;
  }
}

class FakeHost implements AgentHost {
  current: string | null = '1.0.0';
  ready = false;
  constructor(private readonly recorder: Recorder) {}
  async currentVersion() {
    this.recorder.record('Host.currentVersion');
    return this.current;
  }
  async isReady(version: string) {
    this.recorder.record('Host.isReady', version);
    return this.ready;
  }
  async install(r: AgentRelease) {
    this.recorder.record('Host.install', r.agentVersion);
  }
  async buildRuntime(version: string) {
    this.recorder.record('Host.buildRuntime', version);
  }
  async activate(version: string) {
    this.recorder.record('Host.activate', version);
    this.current = version;
  }
  async status() {
    this.recorder.record('Host.status');
    return 'agent 1.1.0 ok';
  }
}

const setup = () => {
  const recorder = new Recorder();
  const host = new FakeHost(recorder);
  const lines: string[] = [];
  const deps = {
    releases: new FakeReleases(recorder),
    host,
    output: { line: (text: string) => lines.push(text) },
  };
  return { recorder, host, lines, deps };
};

const READS = [
  'Releases.resolve latest',
  'Host.currentVersion',
  'Host.isReady 1.1.0',
];

describe('updateAgent', () => {
  it('installs, builds, then repoints, then prints the status', async () => {
    const { recorder, lines, deps } = setup();
    const result = await updateAgent(deps, { dryRun: false });
    expect(result).toEqual({
      outcome: 'installed',
      release,
      previous: '1.0.0',
    });
    expect(recorder.calls).toEqual([
      ...READS,
      'Host.install 1.1.0',
      'Host.buildRuntime 1.1.0',
      'Host.activate 1.1.0',
      'Host.status',
    ]);
    expect(lines).toContain('agent 1.1.0 ok');
    expect(lines.join('\n')).toMatch(/Verify on the Pi/);
  });

  it('resolves the requested version', async () => {
    const { recorder, deps } = setup();
    await updateAgent(deps, { version: '2.3.0', dryRun: false });
    expect(recorder.calls[0]).toBe('Releases.resolve 2.3.0');
  });

  it('installs when there is no current agent at all', async () => {
    const { host, deps } = setup();
    host.current = null;
    await expect(updateAgent(deps, { dryRun: false })).resolves.toMatchObject({
      outcome: 'installed',
      previous: null,
    });
  });

  it('is a no-op when the version is current and ready (it only reads the status)', async () => {
    const { recorder, host, lines, deps } = setup();
    host.current = '1.1.0';
    host.ready = true;
    await expect(updateAgent(deps, { dryRun: false })).resolves.toEqual({
      outcome: 'unchanged',
      release,
    });
    expect(recorder.calls).toEqual([...READS, 'Host.status']);
    expect(lines.join('\n')).toMatch(/already installed/);
  });

  it('finishes an install when current points at the version but it is not ready', async () => {
    const { recorder, host, deps } = setup();
    host.current = '1.1.0';
    host.ready = false;
    await updateAgent(deps, { dryRun: false });
    expect(recorder.calls).toContain('Host.install 1.1.0');
  });

  it('installs a ready version that current does not point at, without redoing the unpack', async () => {
    const { recorder, host, deps } = setup();
    host.ready = true;
    host.current = '1.0.0';
    await updateAgent(deps, { dryRun: false });
    expect(recorder.calls).toContain('Host.install 1.1.0');
  });

  it('only plans on a dry run, and changes nothing', async () => {
    const { recorder, lines, deps } = setup();
    await expect(updateAgent(deps, { dryRun: true })).resolves.toEqual({
      outcome: 'planned',
      release,
    });
    expect(recorder.calls).toEqual(READS);
    const plan = lines.join('\n');
    expect(plan).toMatch(/Dry run/);
    expect(plan).toMatch(/releases\/1\.1\.0/);
    expect(plan).toMatch(/main\.js status/);
  });

  it.each(['Releases.resolve', 'Host.currentVersion', 'Host.isReady'])(
    'stops with nothing changed when %s fails',
    async (method) => {
      const { recorder, deps } = setup();
      recorder.failNext(method, new Error('boom'));
      const result = await updateAgent(deps, { dryRun: false });
      expect(result).toMatchObject({ outcome: 'stopped', repointed: false });
      expect(result).toMatchObject({
        message: expect.stringContaining('boom'),
      });
      expect(recorder.calls.join('\n')).not.toMatch(/install|activate/);
    },
  );

  it.each([
    ['Host.install', ['Host.install 1.1.0']],
    ['Host.buildRuntime', ['Host.install 1.1.0', 'Host.buildRuntime 1.1.0']],
  ])('leaves current untouched when %s fails', async (method, ran) => {
    const { recorder, host, deps } = setup();
    recorder.failNext(method, new Error('boom'));
    const result = await updateAgent(deps, { dryRun: false });
    expect(result).toMatchObject({
      outcome: 'stopped',
      repointed: false,
      message: expect.stringContaining('still points at 1.0.0'),
    });
    expect(recorder.calls).toEqual([...READS, ...ran]);
    expect(host.current).toBe('1.0.0');
  });

  it('reports a failed switch as not repointed', async () => {
    const { recorder, deps } = setup();
    recorder.failNext('Host.activate', new Error('boom'));
    const result = await updateAgent(deps, { dryRun: false });
    expect(result).toMatchObject({ outcome: 'stopped', repointed: false });
    expect(recorder.calls).not.toContain('Host.status');
  });

  it('reports a failing status after the repoint, naming the previous release', async () => {
    const { recorder, deps } = setup();
    recorder.failNext('Host.status', new Error('node crashed'));
    const result = await updateAgent(deps, { dryRun: false });
    expect(result).toMatchObject({
      outcome: 'stopped',
      repointed: true,
      message: expect.stringContaining('releases/1.0.0'),
    });
  });
});
