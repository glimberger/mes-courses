import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type ChangelogSection, renderDocument } from '../../domain/changelog';

// The committed seed of feature 014 (US5): the sections of the releases that existed when the
// changelog was introduced. Later releases add their own section above these.
const ROOT = join(__dirname, '../../../../..');
const markdown = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
const sections: ChangelogSection[] = JSON.parse(
  readFileSync(join(ROOT, 'apps/mobile/src/changelog/changelog.json'), 'utf8'),
);

const SEED = ['2.1.0', '2.0.1', '1.2.0'];
const DROPPED = /^(ci|e2e|test|delivery|chore|docs|refactor|style|build)\b/;
const GROUP_KEYS = ['features', 'fixes', 'performances', 'breaking'] as const;
const entries = sections.flatMap((section) =>
  GROUP_KEYS.flatMap((key) => section[key]),
);

describe('the seeded changelog', () => {
  it('holds the seeded releases, newest first and unique', () => {
    const versions = sections.map(({ version }) => version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions.filter((v) => SEED.includes(v))).toEqual(SEED);
    expect(versions.slice(-SEED.length)).toEqual(SEED);
  });

  it('carries the same sections in CHANGELOG.md and changelog.json', () => {
    expect(markdown).toBe(renderDocument(sections));
  });

  it('follows the data contract', () => {
    for (const section of sections) {
      expect(section.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(section.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const key of GROUP_KEYS)
        expect(Array.isArray(section[key])).toBe(true);
    }
    for (const { text, pr } of entries) {
      expect(typeof text).toBe('string');
      expect(pr === null || Number.isInteger(pr)).toBe(true);
    }
  });

  it('lists no noise: no dropped type or scope, no raw prefix', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const { text } of entries) {
      expect(text).not.toMatch(DROPPED);
      expect(text).not.toMatch(/^[a-z]+(\([^)]*\))?!?:/);
    }
  });

  it('links entries to their pull request', () => {
    expect(entries.some(({ pr }) => pr !== null)).toBe(true);
    expect(markdown).toMatch(
      /\(\[#\d+\]\(https:\/\/github\.com\/glimberger\/mes-courses\/pull\/\d+\)\)/,
    );
  });
});
