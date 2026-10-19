import type { ChannelManifest } from '../domain/manifest';
import { REQUIRED_WORKFLOWS } from '../domain/release-rules';
import type { BumpPullRequest, RunOutcome } from '../domain/release-plan';
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

const productionManifest = (version: string): string =>
  JSON.stringify({
    schema: 1,
    environment: 'production',
    sequence: 20,
    commit: 'a'.repeat(40),
    version,
    createdAt: '2026-10-01T08:00:00.000Z',
    run: { id: 1, url: 'https://github.com/o/r/actions/runs/1' },
    minAgentVersion: '1.0.0',
    server: {
      commit: 'a'.repeat(40),
      sequence: 20,
      version,
      asset: `server-${'a'.repeat(40)}.tar.gz`,
      sha256: 'f'.repeat(64),
      nixpkgsRev: '1'.repeat(40),
    },
    fdroid: null,
  } satisfies ChannelManifest);

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
  autoMergeEnabled: true,
};
const mergedPr = { ...openPr, state: 'merged' as const, mergeCommit: 'sha-1' };

const setup = (prompter = new ScriptedPrompter([], [true])) => {
  const recorder = new Recorder();
  const repository = new InMemoryReleaseRepository(recorder);
  const pullRequests = new InMemoryReleasePullRequests(recorder);
  const releaseRuns = new InMemoryReleaseRuns(recorder);
  const output = new RecordedOutput();
  const source = new InMemoryChannelSource(recorder);
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
    source,
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
    source,
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

  describe('early refusals (US2)', () => {
    const minor = {
      target: { kind: 'bump' as const, bump: 'minor' as const },
      assumeYes: false,
    };
    const refused = (recorder: Recorder) =>
      recorder.calls.filter((call) =>
        /commitBump|\.open |enableAutoMerge|createTag|pushTag|Sleep/.test(call),
      );

    it.each([
      ['not on main', (r: InMemoryReleaseRepository) => (r.branch = 'feat/x')],
      [
        'uncommitted changes',
        (r: InMemoryReleaseRepository) => (r.clean = false),
      ],
      [
        'behind origin/main',
        (r: InMemoryReleaseRepository) => (r.upToDate = false),
      ],
    ])(
      'refuses a checkout that is %s, before asking anything (2.1)',
      async (_, break_) => {
        const { deps, repository, recorder } = setup(new ScriptedPrompter());
        break_(repository);

        const result = await runRelease(deps, minor);

        expect(result.outcome).toBe('stopped');
        expect(refused(recorder)).toEqual([]);
      },
    );

    it('reports every reason of a bad checkout together', async () => {
      const { deps, repository } = setup(new ScriptedPrompter());
      repository.branch = 'feat/x';
      repository.clean = false;
      repository.upToDate = false;

      const result = await runRelease(deps, minor);

      expect(result).toMatchObject({ outcome: 'stopped' });
      expect(
        result.outcome === 'stopped' && result.message.split('\n'),
      ).toHaveLength(3);
    });

    it('rejects an explicit version that is not higher (2.2)', async () => {
      const { deps, recorder } = setup(new ScriptedPrompter());

      const result = await runRelease(deps, {
        target: { kind: 'version', version: '1.1.0' },
        assumeYes: true,
      });

      expect(result).toMatchObject({
        outcome: 'stopped',
        message: expect.stringContaining('not higher'),
      });
      expect(refused(recorder)).toEqual([]);
    });

    it('refuses a version whose tag exists on the remote (2.3)', async () => {
      const { deps, repository, recorder } = setup(new ScriptedPrompter());
      repository.tags.set('v1.3.0', { local: null, remote: 'other' });

      const result = await runRelease(deps, {
        target: { kind: 'bump', bump: 'minor' },
        assumeYes: true,
      });

      expect(result).toMatchObject({
        outcome: 'stopped',
        message: expect.stringContaining('v1.3.0 already exists'),
      });
      expect(refused(recorder)).toEqual([]);
    });

    it('refuses a version not above production (2.3)', async () => {
      const { deps, source, recorder } = setup(new ScriptedPrompter());
      source.channels.set('production', {
        manifest: productionManifest('1.3.0'),
        signature: 'sig',
      });

      const result = await runRelease(deps, {
        target: { kind: 'bump', bump: 'minor' },
        assumeYes: true,
      });

      expect(result).toMatchObject({
        outcome: 'stopped',
        message: expect.stringContaining('which production already runs'),
      });
      expect(refused(recorder)).toEqual([]);
    });

    it('stops with a message when a tool fails during the checks', async () => {
      const { deps, recorder } = setup(new ScriptedPrompter());
      recorder.failNext(
        'ReleaseRepository.isClean',
        new Error('git is not installed'),
      );

      const result = await runRelease(deps, {
        target: { kind: 'bump', bump: 'minor' },
        assumeYes: true,
      });

      expect(result).toMatchObject({
        outcome: 'stopped',
        message: expect.stringContaining('git is not installed'),
      });
    });
  });

  describe('dry run (2.4)', () => {
    it('prints the steps it would take and changes nothing', async () => {
      const { deps, recorder, output, fakeSleep } = setup(
        new ScriptedPrompter(),
      );

      const result = await runRelease(deps, {
        target: { kind: 'bump', bump: 'minor' },
        assumeYes: false,
        dryRun: true,
      });

      expect(result).toEqual({ outcome: 'released' });
      expect(mutations(recorder.calls)).toEqual([]);
      expect(fakeSleep.durations).toEqual([]);
      expect(output.lines[0]).toBe('1.2.0 -> 1.3.0');
      expect(output.lines.filter((l) => l.startsWith('would '))).toEqual([
        'would commit the bump to chore/release-1.3.0 and push it',
        'would open the pull request "chore(release): bump the app version to 1.3.0"',
        'would enable auto-merge (squash) on it',
        'would wait for the pull request to merge',
        `would wait for ${REQUIRED_WORKFLOWS.join(', ')} on the bump commit`,
        'would tag v1.3.0 on the bump commit and push the tag',
      ]);
    });

    it('still refuses a bad checkout', async () => {
      const { deps, repository } = setup(new ScriptedPrompter());
      repository.clean = false;

      const result = await runRelease(deps, {
        target: { kind: 'bump', bump: 'minor' },
        assumeYes: true,
        dryRun: true,
      });

      expect(result.outcome).toBe('stopped');
    });
  });

  describe('waiting paths and failure stops (US3)', () => {
    const minor = {
      target: { kind: 'bump' as const, bump: 'minor' as const },
      assumeYes: true,
    };

    it('stops with the pull request link when it is closed unmerged (3.1)', async () => {
      const { deps, pullRequests, recorder } = setup();
      pullRequests.scriptFound([null, { ...openPr, state: 'closed' }]);

      const result = await runRelease(deps, minor);

      expect(result).toMatchObject({
        outcome: 'stopped',
        message: expect.stringContaining(openPr.url),
      });
      expect(mutations(recorder.calls)).not.toContain(
        'ReleaseRepository.createTag v1.3.0 sha-1',
      );
    });

    it('tags once the pending runs have succeeded (3.2)', async () => {
      const { deps, releaseRuns, recorder, fakeSleep } = setup();
      releaseRuns.scriptRuns([
        runs('pending'),
        runs('pending'),
        runs('success'),
      ]);

      const result = await runRelease(deps, minor);

      expect(result).toEqual({ outcome: 'released' });
      expect(recorder.calls).toContain('ReleaseRepository.pushTag v1.3.0');
      expect(fakeSleep.durations.length).toBeGreaterThanOrEqual(3);
    });

    it.each(REQUIRED_WORKFLOWS)(
      'stops with the link of the failed %s run and does not tag (3.3)',
      async (failing) => {
        const { deps, releaseRuns, recorder } = setup();
        releaseRuns.scriptRuns([
          runs('success').map((run) =>
            run.workflow === failing
              ? { ...run, state: 'failed' as const }
              : run,
          ),
        ]);

        const result = await runRelease(deps, minor);

        expect(result).toMatchObject({
          outcome: 'stopped',
          message: expect.stringContaining(
            `https://github.test/runs/${failing}`,
          ),
        });
        expect(recorder.calls.join('\n')).not.toMatch(/createTag|pushTag/);
      },
    );

    it('tags the bump commit even when origin/main has moved on', async () => {
      const { deps, repository, recorder } = setup();
      const sleep = deps.sleep;
      deps.sleep = async (ms) => {
        await sleep(ms);
        repository.appVersions.set('origin/main', '1.4.0');
      };

      const result = await runRelease(deps, minor);

      expect(result).toEqual({ outcome: 'released' });
      expect(recorder.calls).toContain(
        'ReleaseRepository.createTag v1.3.0 sha-1',
      );
    });

    it('stops with the reason and a resume hint when gh fails mid-wait', async () => {
      const { deps, recorder } = setup();
      recorder.failNext(
        'ReleaseRuns.requiredRuns',
        new Error('gh run list failed: network down'),
      );

      const result = await runRelease(deps, minor);

      expect(result).toMatchObject({
        outcome: 'stopped',
        message: expect.stringMatching(/network down[\s\S]*again to resume/),
      });
      expect(recorder.calls.join('\n')).not.toMatch(/createTag|pushTag/);
    });
  });

  describe('resuming after an interruption (US4)', () => {
    const target = { kind: 'version' as const, version: '1.3.0' };
    const resume = { target, assumeYes: true };
    const creating = (calls: string[]) =>
      calls.filter((call) => /commitBump|\.open |createTag/.test(call));

    it('reuses an open pull request with auto-merge: no second PR or commit (4.1)', async () => {
      const { deps, pullRequests, recorder } = setup();
      pullRequests.scriptFound([openPr]);

      const result = await runRelease(deps, resume);

      expect(result).toEqual({ outcome: 'released' });
      expect(mutations(recorder.calls)).toEqual([
        'ReleaseRepository.createTag v1.3.0 sha-1',
        'ReleaseRepository.pushTag v1.3.0',
      ]);
    });

    it('enables auto-merge once on an open pull request that lacks it', async () => {
      const { deps, pullRequests, recorder } = setup();
      pullRequests.scriptFound([{ ...openPr, autoMergeEnabled: false }]);

      await runRelease(deps, resume);

      expect(
        recorder.calls.filter((call) => call.includes('enableAutoMerge')),
      ).toEqual([
        'ReleasePullRequests.enableAutoMerge https://github.test/pull/1',
      ]);
      expect(creating(recorder.calls)).toEqual([
        'ReleaseRepository.createTag v1.3.0 sha-1',
      ]);
    });

    it('goes to the runs when the bump is already on origin/main (4.2)', async () => {
      const { deps, repository, pullRequests, recorder, landBump } = setup();
      landBump();
      pullRequests.scriptFound([mergedPr]);

      const result = await runRelease(deps, resume);

      expect(result).toEqual({ outcome: 'released' });
      expect(mutations(recorder.calls)).toEqual([
        'ReleaseRepository.createTag v1.3.0 sha-1',
        'ReleaseRepository.pushTag v1.3.0',
      ]);
      expect(repository.tags.get('v1.3.0')).toEqual({
        local: 'sha-1',
        remote: 'sha-1',
      });
    });

    it('only pushes a tag that was created but not pushed', async () => {
      const { deps, repository, recorder, output, landBump } = setup();
      landBump();
      repository.tags.set('v1.3.0', { local: 'sha-1', remote: null });

      const result = await runRelease(deps, resume);

      expect(result).toEqual({ outcome: 'released' });
      expect(mutations(recorder.calls)).toEqual([
        'ReleaseRepository.pushTag v1.3.0',
      ]);
      expect(output.lines).toContain('pushed v1.3.0 on sha-1');
    });

    it('reports an already tagged release and creates nothing (4.3)', async () => {
      const { deps, repository, recorder, output, landBump } = setup();
      landBump();
      repository.tags.set('v1.3.0', { local: 'sha-1', remote: 'sha-1' });

      const result = await runRelease(deps, resume);

      expect(result).toEqual({ outcome: 'released' });
      expect(output.lines).toContain('v1.3.0 is already released');
      expect(mutations(recorder.calls)).toEqual([]);
    });

    it('refuses a tag that is on another commit', async () => {
      const { deps, repository, recorder, landBump } = setup();
      landBump();
      repository.tags.set('v1.3.0', { local: null, remote: 'other' });

      const result = await runRelease(deps, resume);

      expect(result).toMatchObject({
        outcome: 'stopped',
        message: expect.stringContaining('other'),
      });
      expect(mutations(recorder.calls)).toEqual([]);
    });

    it('resumes from a main that is behind origin/main once the bump merged', async () => {
      const { deps, repository, landBump } = setup();
      landBump();
      repository.upToDate = false;

      const result = await runRelease(deps, resume);

      expect(result).toEqual({ outcome: 'released' });
    });
  });
});

/**
 * A small stateful world, so that an interrupted run can be rerun against what the first run left
 * behind. The effects list holds each change that really happened; a second PR, a second auto-merge
 * or a second tag throws, like a duplicate would in the real world.
 */
const world = () => {
  const effects: string[] = [];
  const state = {
    main: '1.2.0',
    branchPushed: false,
    pr: null as null | { autoMerge: boolean; merged: boolean },
    localTag: null as string | null,
    remoteTag: null as string | null,
    runPolls: 0,
    crashAfter: Infinity,
  };
  const effect = (name: string) => {
    effects.push(name);
    if (effects.length >= state.crashAfter) throw new Error('interrupted');
  };
  const pull = (): BumpPullRequest | null =>
    state.pr === null
      ? null
      : {
          state: state.pr.merged ? 'merged' : 'open',
          url: 'https://github.test/pull/1',
          mergeCommit: state.pr.merged ? 'sha-1' : null,
          checksFailed: false,
          autoMergeEnabled: state.pr.autoMerge,
        };
  const deps: ReleaseDeps = {
    repository: {
      currentBranch: async () => 'main',
      isClean: async () => true,
      fetch: async () => undefined,
      isUpToDate: async () => true,
      appVersionAt: async (ref) =>
        ref === 'sha-1'
          ? '1.3.0'
          : ref === 'origin/main'
            ? state.main
            : '1.2.0',
      tagCommit: async () => ({
        local: state.localTag,
        remote: state.remoteTag,
      }),
      async commitBump() {
        // Like the real adapter: a branch already pushed is left alone.
        if (state.branchPushed) return;
        state.branchPushed = true;
        effect('commit');
      },
      async createTag(_tag, sha) {
        if (state.localTag !== null) throw new Error('second tag');
        state.localTag = sha;
        effect('tag');
      },
      async pushTag() {
        if (state.remoteTag !== null) throw new Error('second tag push');
        state.remoteTag = state.localTag;
        effect('push-tag');
      },
      releaseCommit: async () => (state.main === '1.3.0' ? 'sha-1' : null),
    },
    pullRequests: {
      findBump: async () => pull(),
      async open() {
        if (state.pr !== null) throw new Error('second pull request');
        state.pr = { autoMerge: false, merged: false };
        effect('open');
        return pull() as BumpPullRequest;
      },
      async enableAutoMerge() {
        if (state.pr?.autoMerge) throw new Error('second auto-merge');
        if (state.pr) state.pr.autoMerge = true;
        effect('auto-merge');
      },
    },
    runs: {
      async requiredRuns() {
        state.runPolls += 1;
        return runs(state.runPolls < 2 ? 'pending' : 'success');
      },
      releaseRunUrl: async () => 'https://github.test/actions/runs/release',
    },
    source: new InMemoryChannelSource(),
    prompter: new ScriptedPrompter(),
    output: new RecordedOutput(),
    async sleep() {
      // Auto-merge lands the bump during the wait.
      if (state.pr?.autoMerge) {
        state.pr.merged = true;
        state.main = '1.3.0';
      }
    },
  };
  return { deps, state, effects };
};

describe('runRelease interrupted at every step (SC-004)', () => {
  const request = {
    target: { kind: 'version' as const, version: '1.3.0' },
    assumeYes: true,
  };
  const HAPPY = ['commit', 'open', 'auto-merge', 'tag', 'push-tag'];

  /** The explicit version 1.3.0 is higher than main 1.2.0 on the first run, equal after the merge. */
  it('does the five changes exactly once in one uninterrupted run', async () => {
    const { deps, effects } = world();

    expect(await runRelease(deps, request)).toEqual({ outcome: 'released' });
    expect(effects).toEqual(HAPPY);
  });

  it.each([1, 2, 3, 4, 5])(
    'makes the same five changes in total when interrupted after change %i',
    async (crashAfter) => {
      const { deps, state, effects } = world();
      state.crashAfter = crashAfter;

      const first = await runRelease(deps, request);
      expect(first.outcome).toBe('stopped');

      state.crashAfter = Infinity;
      expect(await runRelease(deps, request)).toEqual({ outcome: 'released' });
      expect(effects).toEqual(HAPPY);
      expect(state.remoteTag).toBe('sha-1');
    },
  );

  it('survives an interruption at every change in a row', async () => {
    const { deps, state, effects } = world();
    for (let crashAfter = 1; crashAfter <= 5; crashAfter += 1) {
      state.crashAfter = crashAfter;
      await runRelease(deps, request);
    }
    state.crashAfter = Infinity;

    expect(await runRelease(deps, request)).toEqual({ outcome: 'released' });
    expect(effects).toEqual(HAPPY);
  });
});
