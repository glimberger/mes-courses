import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Components and screens take their type from the scale or from typeOverrides, never from a
// weight or a size they write themselves (SC-003).
const UI_ROOT = path.resolve(__dirname, '..');

const sourceFiles = [
  ...globSync('{components,screens}/**/*.tsx', { cwd: UI_ROOT }),
].filter((file) => !/\.(test|stories)\.tsx$/.test(file));

const FORBIDDEN = [
  { name: 'fontWeight', pattern: /\bfontWeight\s*:/ },
  { name: 'Nunito_400Regular', pattern: /Nunito_400Regular/ },
  { name: 'a numeric fontSize', pattern: /\bfontSize\s*:\s*\d/ },
];

describe('typography in components and screens', () => {
  it('scans the shared blocks and the screens', () => {
    expect(sourceFiles.length).toBeGreaterThan(40);
  });

  it.each(FORBIDDEN)('never writes $name', ({ pattern }) => {
    const hits = sourceFiles.filter((file) =>
      pattern.test(readFileSync(path.join(UI_ROOT, file), 'utf8')),
    );
    expect(hits).toEqual([]);
  });
});
