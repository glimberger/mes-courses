import {
  evaluateRelease,
  tagVersion,
  type ReleaseFacts,
} from './release-rules';

const good: ReleaseFacts = {
  tag: 'v1.2.0',
  appVersion: '1.2.0',
  onMain: true,
  successfulWorkflows: ['CI', 'E2E Android', 'Deliver staging'],
  productionVersion: '1.1.0',
};

describe('evaluateRelease', () => {
  it('accepts a validated commit with a higher version', () => {
    expect(evaluateRelease(good)).toEqual([]);
  });

  it('accepts the first production release', () => {
    expect(evaluateRelease({ ...good, productionVersion: null })).toEqual([]);
  });

  it.each(['1.2.0', 'v1.2', 'v1.2.0-rc1', 'v01.2.0x', 'release-1'])(
    'refuses the malformed tag %s',
    (tag) => {
      const failures = evaluateRelease({ ...good, tag });
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatch(/not of the form vX\.Y\.Z/);
    },
  );

  it('refuses a tag that differs from the app version and names the expected one', () => {
    const failures = evaluateRelease({ ...good, appVersion: '1.1.5' });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/expected tag v1\.1\.5/);
  });

  it('refuses a commit that is not on main', () => {
    expect(evaluateRelease({ ...good, onMain: false })).toEqual([
      'The tagged commit is not on main',
    ]);
  });

  it.each(['CI', 'E2E Android', 'Deliver staging'])(
    'refuses a commit without a successful %s run',
    (workflow) => {
      const failures = evaluateRelease({
        ...good,
        successfulWorkflows: good.successfulWorkflows.filter(
          (name) => name !== workflow,
        ),
      });
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(`"${workflow}"`);
    },
  );

  it.each(['1.2.0', '1.3.0'])(
    'refuses a version not higher than production (%s)',
    (productionVersion) => {
      const failures = evaluateRelease({ ...good, productionVersion });
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatch(/not higher than/);
    },
  );

  it('lists every failed rule at once', () => {
    const failures = evaluateRelease({
      tag: 'v1.0.0',
      appVersion: '1.2.0',
      onMain: false,
      successfulWorkflows: [],
      productionVersion: '1.1.0',
    });
    expect(failures).toHaveLength(6);
  });
});

describe('tagVersion', () => {
  it('reads the version of a tag', () => {
    expect(tagVersion('v10.2.33')).toBe('10.2.33');
    expect(tagVersion('v1.2')).toBeNull();
  });
});
