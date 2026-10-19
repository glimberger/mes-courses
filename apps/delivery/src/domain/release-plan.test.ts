import {
  checkNewVersion,
  checkPrerequisites,
  decideStep,
  nextVersion,
  parseTarget,
  readAppVersion,
  setAppVersion,
  validateExplicitVersion,
  type ReleaseState,
} from './release-plan';

// A sample of apps/mobile/app.config.ts (the domain may not read the real file).
const realConfig = `const config = {
  name: variant.name,
  slug: 'mes-courses',
  // Semantic versioning, set by hand in the pull request that leads to a release (research R24);
  // the build number is EAS's, remote and incremented on every build.
  version: '1.2.0',
  orientation: 'portrait',
  extra: { eas: { projectId: 'x' } },
};
`;

describe('nextVersion', () => {
  it.each([
    ['major', '2.0.0'],
    ['minor', '1.3.0'],
    ['patch', '1.2.4'],
  ] as const)('%s bump of 1.2.3 gives %s', (bump, expected) => {
    expect(nextVersion('1.2.3', bump)).toBe(expected);
  });
});

describe('parseTarget', () => {
  it.each(['major', 'minor', 'patch'] as const)('reads %s', (bump) => {
    expect(parseTarget(bump)).toEqual({ kind: 'bump', bump });
  });

  it('reads an explicit version', () => {
    expect(parseTarget('1.4.0')).toEqual({ kind: 'version', version: '1.4.0' });
  });

  it('asks when there is no argument', () => {
    expect(parseTarget(undefined)).toEqual({ kind: 'ask' });
  });

  it('keeps an unknown argument as a version to be validated', () => {
    expect(parseTarget('huge')).toEqual({ kind: 'version', version: 'huge' });
  });
});

describe('validateExplicitVersion', () => {
  it('accepts a strictly higher version', () => {
    expect(validateExplicitVersion('1.3.0', '1.2.0')).toEqual([]);
  });

  it.each(['1.3', 'v1.3.0', '1.3.0-staging.1', 'huge', '01.3.0'])(
    'refuses the malformed version %s',
    (version) => {
      const errors = validateExplicitVersion(version, '1.2.0');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(
        `The version ${version} is not of the form X.Y.Z (for example 1.3.0)`,
      );
    },
  );

  it.each(['1.2.0', '1.1.9'])('refuses %s, not above 1.2.0', (version) => {
    expect(validateExplicitVersion(version, '1.2.0')).toEqual([
      `The version ${version} is not higher than the current version 1.2.0`,
    ]);
  });
});

describe('readAppVersion and setAppVersion', () => {
  it('reads the version of a sample of app.config.ts', () => {
    expect(readAppVersion(realConfig)).toBe('1.2.0');
  });

  it('sets the version and changes nothing else', () => {
    const updated = setAppVersion(realConfig, '9.8.7');
    expect(readAppVersion(updated)).toBe('9.8.7');
    expect(updated.replace('9.8.7', readAppVersion(realConfig))).toBe(
      realConfig,
    );
  });

  it('throws when no version line matches', () => {
    expect(() => readAppVersion('const a = 1;')).toThrow(/no version/i);
    expect(() => setAppVersion('const a = 1;', '1.0.0')).toThrow(/no version/i);
  });

  it('throws when several version lines match', () => {
    const twice = "  version: '1.0.0',\n  version: '2.0.0',\n";
    expect(() => readAppVersion(twice)).toThrow(/several/i);
    expect(() => setAppVersion(twice, '3.0.0')).toThrow(/several/i);
  });
});

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

const runs = (
  states: ('success' | 'failed' | 'pending')[] = [
    'success',
    'success',
    'success',
  ],
) =>
  ['CI', 'E2E Android', 'Deliver staging'].map((workflow, index) => ({
    workflow,
    state: states[index],
    url: `https://example.test/runs/${workflow}`,
  }));

/** The state right after the bump landed on main with all runs green, no tag yet. */
const landed: ReleaseState = {
  mainVersion: '1.3.0',
  localTag: null,
  remoteTag: null,
  bumpPr: null,
  releaseCommit: SHA,
  runs: runs(),
  productionVersion: '1.2.0',
};

const before = (bumpPr: ReleaseState['bumpPr']): ReleaseState => ({
  ...landed,
  mainVersion: '1.2.0',
  releaseCommit: null,
  runs: [],
  bumpPr,
});

const pr = (patch: Partial<NonNullable<ReleaseState['bumpPr']>> = {}) => ({
  state: 'open' as const,
  url: 'https://example.test/pull/1',
  mergeCommit: null,
  checksFailed: false,
  autoMergeEnabled: true,
  ...patch,
});

describe('decideStep', () => {
  it('is done when the tag is on the release commit', () => {
    expect(
      decideStep('1.3.0', { ...landed, remoteTag: SHA, localTag: SHA }),
    ).toEqual({ step: 'done' });
  });

  it('is done when only the remote tag exists on the release commit', () => {
    expect(decideStep('1.3.0', { ...landed, remoteTag: SHA })).toEqual({
      step: 'done',
    });
  });

  it.each([
    ['remote', { remoteTag: OTHER }],
    ['local', { localTag: OTHER }],
  ])('refuses when the %s tag is on another commit', (_, tags) => {
    expect(decideStep('1.3.0', { ...landed, ...tags })).toEqual({
      step: 'stop-tag-elsewhere',
      tag: 'v1.3.0',
      commit: OTHER,
    });
  });

  it('pushes the tag when it exists only locally, on the release commit', () => {
    expect(decideStep('1.3.0', { ...landed, localTag: SHA })).toEqual({
      step: 'push-tag',
    });
  });

  it('refuses a tag when the bump is not on main yet', () => {
    expect(decideStep('1.3.0', { ...before(null), remoteTag: OTHER })).toEqual({
      step: 'stop-tag-elsewhere',
      tag: 'v1.3.0',
      commit: OTHER,
    });
  });

  it('tags when main has the version and the three runs succeeded', () => {
    expect(decideStep('1.3.0', landed)).toEqual({ step: 'tag' });
  });

  it('tags the release commit even when main has moved on to a later version', () => {
    expect(decideStep('1.3.0', { ...landed, mainVersion: '1.4.0' })).toEqual({
      step: 'tag',
    });
  });

  it('waits for runs that are pending', () => {
    expect(
      decideStep('1.3.0', {
        ...landed,
        runs: runs(['success', 'pending', 'success']),
      }),
    ).toEqual({ step: 'wait-runs' });
  });

  it('waits when a required run does not exist yet', () => {
    expect(
      decideStep('1.3.0', { ...landed, runs: runs().slice(0, 2) }),
    ).toEqual({ step: 'wait-runs' });
  });

  it('stops with the link of a failed run, even if others are pending', () => {
    expect(
      decideStep('1.3.0', {
        ...landed,
        runs: runs(['pending', 'failed', 'success']),
      }),
    ).toEqual({
      step: 'stop-run-failed',
      url: 'https://example.test/runs/E2E Android',
    });
  });

  it('opens the bump when main is old and there is no pull request', () => {
    expect(decideStep('1.3.0', before(null))).toEqual({ step: 'open-bump' });
  });

  it('waits for an open pull request', () => {
    expect(decideStep('1.3.0', before(pr()))).toEqual({ step: 'wait-merge' });
  });

  it('enables auto-merge on an open pull request that lacks it', () => {
    expect(
      decideStep('1.3.0', before(pr({ autoMergeEnabled: false }))),
    ).toEqual({ step: 'enable-auto-merge' });
  });

  it('stops on failed checks before enabling auto-merge', () => {
    expect(
      decideStep(
        '1.3.0',
        before(pr({ autoMergeEnabled: false, checksFailed: true })),
      ),
    ).toMatchObject({ step: 'stop-pr-failed' });
  });

  it('stops when the checks of the pull request failed', () => {
    expect(decideStep('1.3.0', before(pr({ checksFailed: true })))).toEqual({
      step: 'stop-pr-failed',
      url: 'https://example.test/pull/1',
    });
  });

  it('stops when the pull request was closed unmerged', () => {
    expect(decideStep('1.3.0', before(pr({ state: 'closed' })))).toEqual({
      step: 'stop-pr-closed',
      url: 'https://example.test/pull/1',
    });
  });

  it('waits and re-observes when the pull request is merged but main is old', () => {
    expect(
      decideStep('1.3.0', before(pr({ state: 'merged', mergeCommit: SHA }))),
    ).toEqual({ step: 'wait-runs' });
  });
});

describe('checkPrerequisites', () => {
  const fine = { branch: 'main', clean: true, upToDate: true };

  it('accepts a clean main that matches origin/main', () => {
    expect(checkPrerequisites(fine)).toEqual([]);
  });

  it('refuses a branch other than main, naming it', () => {
    const [reason, ...others] = checkPrerequisites({
      ...fine,
      branch: 'feat/x',
    });
    expect(reason).toContain('feat/x');
    expect(others).toEqual([]);
  });

  it('refuses uncommitted changes', () => {
    expect(checkPrerequisites({ ...fine, clean: false })).toEqual([
      expect.stringContaining('uncommitted changes'),
    ]);
  });

  it('refuses a main that differs from origin/main', () => {
    expect(checkPrerequisites({ ...fine, upToDate: false })).toEqual([
      expect.stringContaining('origin/main'),
    ]);
  });

  it('reports every reason at once', () => {
    expect(
      checkPrerequisites({ branch: 'x', clean: false, upToDate: false }),
    ).toHaveLength(3);
  });
});

describe('checkNewVersion', () => {
  const fine = {
    version: '1.3.0',
    mainVersion: '1.2.0',
    productionVersion: '1.2.0' as string | null,
    tagExists: false,
  };

  it('accepts a version above main and production with no tag', () => {
    expect(checkNewVersion(fine)).toEqual([]);
    expect(checkNewVersion({ ...fine, productionVersion: null })).toEqual([]);
  });

  it('refuses a version that is not higher than main', () => {
    expect(
      checkNewVersion({
        ...fine,
        version: '1.2.0',
        productionVersion: null,
      }),
    ).toEqual([
      expect.stringContaining('not higher than the current version 1.2.0'),
    ]);
  });

  it('refuses a version whose tag exists', () => {
    expect(checkNewVersion({ ...fine, tagExists: true })).toEqual([
      expect.stringContaining('v1.3.0 already exists'),
    ]);
  });

  it('refuses a version not above production, with the gate wording', () => {
    expect(checkNewVersion({ ...fine, productionVersion: '1.4.0' })).toEqual([
      expect.stringContaining('which production already runs'),
    ]);
  });

  it('reports every reason at once', () => {
    expect(
      checkNewVersion({
        version: '1.1.0',
        mainVersion: '1.2.0',
        productionVersion: '1.2.0',
        tagExists: true,
      }),
    ).toHaveLength(3);
  });
});
