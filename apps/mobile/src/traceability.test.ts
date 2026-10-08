/**
 * @jest-environment node
 */
import {
  copyFileSync,
  globSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '../..');
const SPEC = path.join(REPO_ROOT, 'specs/001-shopping-lists/spec.md');

/**
 * Every requirement and scenario id of the spec: each "**FR-…**" it defines, and "US<story>-<n>"
 * for the n-th acceptance scenario of each user story, but those marked "Removed".
 */
const specIds = (spec: string): string[] => {
  const requirements = [
    ...new Set(
      [...spec.matchAll(/\*\*(FR-\d{3}[a-z]?)\*\*/g)].map((match) => match[1]),
    ),
  ];
  const scenarios: string[] = [];
  let story: string | undefined;
  let inScenarios = false;
  for (const line of spec.split('\n')) {
    const heading = /^### User Story (\d+)\b/.exec(line);
    if (heading) {
      story = heading[1];
      inScenarios = false;
    } else if (/^#{1,3} /.test(line)) {
      story = undefined;
    } else if (line.startsWith('**Acceptance Scenarios**')) {
      inScenarios = story !== undefined;
    } else if (/^\*\*/.test(line)) {
      inScenarios = false;
    }
    const item = inScenarios ? /^(\d+)\. (.*)$/.exec(line) : null;
    if (item && !/^\**Removed\b/.test(item[2] ?? '')) {
      scenarios.push(`US${story}-${item[1]}`);
    }
  }
  return [...requirements, ...scenarios].filter(
    (id): id is string => id !== undefined,
  );
};

/** The ids no source cites; "FR-030" is not cited by "FR-030a", nor "US1-1" by "US1-10". */
const uncited = (ids: string[], sources: string[]): string[] =>
  ids.filter((id) => {
    const cited = new RegExp(`(?<![\\w-])${id}(?![0-9a-z])`);
    return !sources.some((source) => cited.test(source));
  });

/**
 * Where an id may be cited: the app's tests (build-time ones included, where FR-041 is), the
 * journeys, and the manual checks of quickstart.md. This file is left out: it cites no id.
 */
const citingSources = (): string[] =>
  [
    ...globSync('src/**/*.test.{ts,tsx}', { cwd: APP_ROOT }).map((file) =>
      path.join(APP_ROOT, file),
    ),
    ...globSync('build-config/**/*.test.ts', { cwd: APP_ROOT }).map((file) =>
      path.join(APP_ROOT, file),
    ),
    ...globSync('tests/e2e/journeys/*.e2e.ts', { cwd: REPO_ROOT }).map((file) =>
      path.join(REPO_ROOT, file),
    ),
    path.join(REPO_ROOT, 'specs/001-shopping-lists/quickstart.md'),
  ]
    .filter((file) => file !== __filename)
    .map((file) => readFileSync(file, 'utf8'));

describe('traceability of spec 001 (Principle II)', () => {
  it('reads every requirement and every scenario of the spec', () => {
    const ids = specIds(readFileSync(SPEC, 'utf8'));

    expect(ids.filter((id) => id.startsWith('FR-')).length).toBeGreaterThan(40);
    expect(ids).toEqual(
      expect.arrayContaining([
        'FR-030a',
        'FR-039a',
        'FR-041',
        'US1-12',
        'US4-5',
      ]),
    );
  });

  it('skips a scenario marked "Removed"', () => {
    const spec = [
      '### User Story 1 - Story',
      '**Acceptance Scenarios**:',
      '1. **Given** a list, **When** I open it, **Then** it shows.',
      '2. Removed.',
      '3. **Given** a list, **When** I close it, **Then** it hides.',
    ].join('\n');

    expect(specIds(spec)).toEqual(['US1-1', 'US1-3']);
  });

  it('names an id no test, journey or manual check cites, read from a copy of the spec', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'mes-courses-spec-'));
    try {
      const copy = path.join(folder, 'spec.md');
      copyFileSync(SPEC, copy);
      writeFileSync(
        copy,
        `${readFileSync(copy, 'utf8')}\n- **FR-999**: A requirement no test cites.\n`,
      );

      expect(
        uncited(specIds(readFileSync(copy, 'utf8')), citingSources()),
      ).toEqual(['FR-999']);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('every requirement and scenario of the spec is cited by a test name, a journey or quickstart.md', () => {
    expect(
      uncited(specIds(readFileSync(SPEC, 'utf8')), citingSources()),
    ).toEqual([]);
  });
});
