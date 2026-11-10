import {
  InMemoryChangelogGenerator,
  InMemoryReleasePullRequests,
  InMemoryReleaseRepository,
  InMemoryReleaseRuns,
  FakeSleep,
  RecordedOutput,
  ScriptedPrompter,
  scripted,
} from './in-memory-doubles';
import { Recorder } from './recorder';

describe('scripted', () => {
  it('returns the steps in order, then repeats the last one', () => {
    const next = scripted(['a', 'b']);
    expect([next(), next(), next(), next()]).toEqual(['a', 'b', 'b', 'b']);
  });

  it('throws when it has no step at all', () => {
    expect(() => scripted<string>([])()).toThrow();
  });
});

describe('release doubles', () => {
  it('record every call in the shared log, in order', async () => {
    const recorder = new Recorder();
    const repository = new InMemoryReleaseRepository(recorder);
    const pulls = new InMemoryReleasePullRequests(recorder);
    const runs = new InMemoryReleaseRuns(recorder);
    await repository.commitBump('1.3.0', 'chore/release-1.3.0');
    const pr = await pulls.open('chore/release-1.3.0', 'title');
    await pulls.enableAutoMerge(pr);
    await runs.requiredRuns('abc');
    await repository.createTag('v1.3.0', 'abc');
    await repository.pushTag('v1.3.0');
    expect(recorder.calls).toEqual([
      'ReleaseRepository.commitBump 1.3.0 chore/release-1.3.0',
      'ReleasePullRequests.open chore/release-1.3.0 title',
      `ReleasePullRequests.enableAutoMerge ${pr.url}`,
      'ReleaseRuns.requiredRuns abc',
      'ReleaseRepository.createTag v1.3.0 abc',
      'ReleaseRepository.pushTag v1.3.0',
    ]);
  });

  it('changelog generator records the call and returns its scripted section', async () => {
    const recorder = new Recorder();
    const changelog = new InMemoryChangelogGenerator(recorder);
    changelog.section = {
      version: 'ignored',
      date: 'ignored',
      features: [{ text: 'add dark mode', pr: 190 }],
      fixes: [],
      performances: [],
      breaking: [],
    };
    expect(await changelog.generate('1.3.0', '2026-11-10')).toEqual({
      version: '1.3.0',
      date: '2026-11-10',
      features: [{ text: 'add dark mode', pr: 190 }],
      fixes: [],
      performances: [],
      breaking: [],
    });
    expect(recorder.calls).toEqual([
      'ChangelogGenerator.generate 1.3.0 2026-11-10',
    ]);
  });

  it('changelog generator gives an empty section by default and can be scripted to fail', async () => {
    const recorder = new Recorder();
    const changelog = new InMemoryChangelogGenerator(recorder);
    expect(await changelog.generate('1.3.0', '2026-11-10')).toEqual({
      version: '1.3.0',
      date: '2026-11-10',
      features: [],
      fixes: [],
      performances: [],
      breaking: [],
    });
    recorder.failNext(
      'ChangelogGenerator.generate',
      new Error('git-cliff is not installed'),
    );
    await expect(changelog.generate('1.3.0', '2026-11-10')).rejects.toThrow(
      'git-cliff is not installed',
    );
  });

  it('fake sleep records durations without waiting', async () => {
    const sleep = new FakeSleep();
    await sleep.sleep(30_000);
    expect(sleep.durations).toEqual([30_000]);
  });

  it('prompter answers from its script and records the questions', async () => {
    const prompter = new ScriptedPrompter(['minor'], [true]);
    expect(await prompter.ask('Which?')).toBe('minor');
    expect(await prompter.confirm('Sure?')).toBe(true);
    expect(prompter.questions).toEqual(['Which?', 'Sure?']);
  });

  it('output keeps the printed lines', () => {
    const output = new RecordedOutput();
    output.line('hello');
    expect(output.lines).toEqual(['hello']);
  });
});
