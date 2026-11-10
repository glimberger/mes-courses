import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import {
  type ChangelogSection,
  renderDocument,
  serializeData,
} from '../../domain/changelog';

// The generated files are committed and checked by `pnpm format:check` (research R9). This test
// lives next to the adapters because the domain may not start a process.
const ROOT = join(__dirname, '../../../../..');
const PRETTIER = join(ROOT, 'node_modules/.bin/prettier');

const formatted = (text: string, file: string) =>
  execFileSync(PRETTIER, ['--stdin-filepath', join(ROOT, file)], {
    cwd: ROOT,
    input: text,
    encoding: 'utf8',
  });

const sections: ChangelogSection[] = [
  {
    version: '2.1.0',
    date: '2026-11-02',
    features: [
      { text: 'add dark mode to `settings_screen`', pr: 190 },
      { text: 'show <b> and [x](y) *as is* (really)', pr: null },
    ],
    fixes: [{ text: 'keep "the" quantity \\ on sync', pr: 12 }],
    performances: [{ text: 'faster list', pr: 3 }],
    breaking: [{ text: 'drop node 22', pr: 7 }],
  },
  {
    version: '2.0.1',
    date: '2026-10-01',
    features: [],
    fixes: [],
    performances: [],
    breaking: [],
  },
];

describe('generated changelog files', () => {
  it('CHANGELOG.md is already formatted as Prettier writes it', () => {
    const markdown = renderDocument(sections);
    expect(formatted(markdown, 'CHANGELOG.md')).toBe(markdown);
  });

  it('changelog.json is already formatted as Prettier writes it', () => {
    const data = serializeData(sections);
    expect(formatted(data, 'apps/mobile/src/changelog/changelog.json')).toBe(
      data,
    );
  });
});
