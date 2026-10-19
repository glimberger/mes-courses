import { REQUIRED_WORKFLOWS } from '../domain/release-rules';
import type { RunOutcome } from '../domain/release-plan';
import { runRelease, type ReleaseDeps } from './run-release';
import {
  FakeSleep,
  InMemoryChannelSource,
  InMemoryReleasePullRequests,
  InMemoryReleaseRepository,
  InMemoryReleaseRuns,
  RecordedOutput,
  ScriptedPrompter,
} from './testing/in-memory-doubles';
import { Recorder } from './testing/recorder';

const runs = (state: RunOutcome['state']): RunOutcome[] =>
  REQUIRED_WORKFLOWS.map((workflow) => ({
    workflow,
    state,
    url: `https://github.test/runs/${workflow}`,
  }));

const openPr = {
  state: 'open' as const,
  url: 'https://github.test/pull/1',
  mergeCommit: null,
  checksFailed: false,
};
const mergedPr = { ...openPr, state: 'merged' as const, mergeCommit: 'sha-1' };

const setup = (prompter = new ScriptedPrompter([], [true])) => {
  const recorder = new Recorder();
  const repository = new InMemoryReleaseRepository(recorder);
  const pullRequests = new InMemoryReleasePullRequests(recorder);
  const releaseRuns = new InMemoryReleaseRuns(recorder);
  const output = new RecordedOutput();
  const fakeSleep = new FakeSleep();
  /** The bump lands on origin/main during the first wait. */
  const landBump = () => {
    repository.appVersions.set('origin/main', '1.3.0');
    repository.appVersions.set('sha-1', '1.3.0');
  };
  let sleeps = 0;
  const deps: ReleaseDeps = {
    repository,
    pullRequests,
    runs: releaseRuns,
    source: new InMemoryChannelSource(recorder),
    prompter,
    output,
    sleep: async (ms) => {
      sleeps += 1;
      recorder.record('Sleep', ms);
      await fakeSleep.sleep(ms);
      if (sleeps === 1) landBump();
    },
  };
  repository.appVersions.set('origin/main', '1.2.0');
  repository.scriptReleaseCommits(['sha-1']);
  pullRequests.scriptFound([null, openPr, openPr, mergedPr]);
  releaseRuns.scriptRuns([runs('pending'), runs('success')]);
  return {
    recorder,
    repository,
    pullRequests,
    releaseRuns,
    output,
    fakeSleep,
    deps,
    landBump,
  };
};

const mutations = (calls: string[]) =>
  calls.filter((call) =>
    /commitBump|\.open |enableAutoMerge|createTag|pushTag/.test(call),
  );

describe('runRelease', () => {
  it('releases a minor bump, in order, after confirmation (scenario 1.1)', async () => {
    const { deps, recorder, output } = setup();

    const result = await runRelease(deps, {
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: false,
    });

    expect(result).toEqual({ outcome: 'released' });
    expect(output.lines[0]).toBe('1.2.0 -> 1.3.0');
    expect(mutations(recorder.calls)).toEqual([
      'ReleaseRepository.commitBump 1.3.0',
      'ReleasePullRequests.open chore/release-1.3.0 chore(release): bump the app version to 1.3.0',
      'ReleasePullRequests.enableAutoMerge https://github.test/pull/1',
      'ReleaseRepository.createTag v1.3.0 sha-1',
      'ReleaseRepository.pushTag v1.3.0',
    ]);
    expect(output.lines).toEqual(
      expect.arrayContaining([
        'bump pull request: https://github.test/pull/1',
        `waiting for ${REQUIRED_WORKFLOWS.join(', ')} on sha-1`,
        'tagged v1.3.0 on sha-1',
        'Release run: https://github.test/actions/runs/release',
      ]),
    );
    expect(recorder.calls.at(-1)).toBe('ReleaseRuns.releaseRunUrl sha-1');
  });

  it('uses an explicit version without asking for the bump (scenario 1.2)', async () => {
    const { deps, output, recorder } = setup();

    await runRelease(deps, {
      target: { kind: 'version', version: '2.0.0' },
      assumeYes: false,
    });

    expect(output.lines[0]).toBe('1.2.0 -> 2.0.0');
    expect(recorder.calls).toContain('ReleaseRepository.commitBump 2.0.0');
  });

  it('asks for the bump type when there is no target (scenario 1.3)', async () => {
    const prompter = new ScriptedPrompter(['patch'], [true]);
    const { deps, output } = setup(prompter);

    await runRelease(deps, { target: { kind: 'ask' }, assumeYes: false });

    expect(prompter.questions).toHaveLength(2);
    expect(output.lines[0]).toBe('1.2.0 -> 1.2.1');
  });

  it('skips the confirmation with assumeYes (scenario 1.4)', async () => {
    const prompter = new ScriptedPrompter();
    const { deps } = setup(prompter);

    const result = await runRelease(deps, {
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: true,
    });

    expect(result.outcome).toBe('released');
    expect(prompter.questions).toEqual([]);
  });

  it('changes nothing when the confirmation is declined (scenario 1.5)', async () => {
    const { deps, recorder } = setup(new ScriptedPrompter([], [false]));

    const result = await runRelease(deps, {
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: false,
    });

    expect(result).toEqual({ outcome: 'declined' });
    expect(mutations(recorder.calls)).toEqual([]);
  });

  it('waits 30 s between observations', async () => {
    const { deps, fakeSleep } = setup();

    await runRelease(deps, {
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: true,
    });

    expect(fakeSleep.durations.length).toBeGreaterThan(0);
    expect(new Set(fakeSleep.durations)).toEqual(new Set([30_000]));
  });

  it('stops with the pull request link when it fails its checks', async () => {
    const { deps, pullRequests, recorder } = setup();
    pullRequests.scriptFound([null, { ...openPr, checksFailed: true }]);

    const result = await runRelease(deps, {
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: true,
    });

    expect(result.outcome).toBe('stopped');
    expect(result).toMatchObject({
      message: expect.stringContaining(openPr.url),
    });
    expect(recorder.calls).not.toContain('ReleaseRepository.createTag');
  });

  it('stops with the run link when a required run fails', async () => {
    const { deps, releaseRuns } = setup();
    releaseRuns.scriptRuns([runs('failed')]);

    const result = await runRelease(deps, {
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: true,
    });

    expect(result).toMatchObject({
      outcome: 'stopped',
      message: expect.stringContaining('https://github.test/runs/CI'),
    });
  });

  it('stops after 90 minutes of waiting and says to run the command again', async () => {
    const { deps, pullRequests, releaseRuns, fakeSleep } = setup();
    pullRequests.scriptFound([null, mergedPr]);
    releaseRuns.scriptRuns([runs('pending')]);

    const result = await runRelease(deps, {
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: true,
    });

    expect(result).toMatchObject({
      outcome: 'stopped',
      message: expect.stringContaining('run the same command again'),
    });
    expect(fakeSleep.durations).toHaveLength(180);
  });

  it('stops when the remote main version changed before the commit', async () => {
    const { deps, repository, recorder } = setup();
    const appVersionAt = repository.appVersionAt.bind(repository);
    let reads = 0;
    repository.appVersionAt = async (ref) => {
      reads += 1;
      const version = await appVersionAt(ref);
      return reads > 2 ? '1.2.5' : version;
    };

    const result = await runRelease(deps, {
      target: { kind: 'bump', bump: 'minor' },
      assumeYes: true,
    });

    expect(result.outcome).toBe('stopped');
    expect(mutations(recorder.calls)).toEqual([]);
  });

  it('reports an already tagged release as done', async () => {
    const { deps, repository, recorder } = setup();
    repository.appVersions.set('origin/main', '1.3.0');
    repository.tags.set('v1.3.0', { local: 'sha-1', remote: 'sha-1' });

    const result = await runRelease(deps, {
      target: { kind: 'version', version: '1.3.0' },
      assumeYes: true,
    });

    expect(result).toEqual({ outcome: 'released' });
    expect(mutations(recorder.calls)).toEqual([]);
  });
});
