import { readFileSync } from 'node:fs';
import path from 'node:path';

import { globSync } from 'glob';

// The mockup look lives in the shared blocks (research R1, FR-011): no screen or component may
// bring back a Paper part the blocks replace. Tests and stories are not the app's UI.
const UI_ROOT = path.resolve(__dirname, '..');

/** Each rule: the pattern, and the one file (under components/) where it is allowed. */
const RULES: { name: string; pattern: RegExp; allowedIn?: string }[] = [
  { name: 'Appbar.Header', pattern: /Appbar\.Header/ },
  { name: 'Checkbox.Android', pattern: /Checkbox\.Android/ },
  { name: 'elevation', pattern: /\belevation\s*[:=]/ },
  { name: 'Surface elevation', pattern: /Surface\s+elevation/ },
  {
    name: 'Paper Dialog',
    pattern: /<Dialog[\s>]\s*[a-z]/,
    allowedIn: 'AppDialog.tsx',
  },
  {
    name: 'Paper Snackbar',
    pattern: /<Snackbar[\s>]\s*[a-z]/,
    allowedIn: 'BrandSnackbar.tsx',
  },
  {
    name: 'numberOfLines on Text',
    pattern: /numberOfLines=/,
    // Titles wrap everywhere but on a row that asks for an ellipsis (an email has no space to
    // wrap at); the row decides it through `titleNumberOfLines`.
    allowedIn: 'SettingsRow.tsx',
  },
];

const sources = () =>
  globSync('{components,screens}/**/*.{ts,tsx}', { cwd: UI_ROOT })
    .filter((file) => !/\.(test|stories)\.tsx?$/.test(file))
    .map((file) => ({
      file,
      text: readFileSync(path.join(UI_ROOT, file), 'utf8'),
    }));

describe('the mockup look is built in the shared blocks', () => {
  it.each(RULES)(
    'no $name outside its shared block',
    ({ pattern, allowedIn }) => {
      const hits = sources()
        .filter(({ file }) => !allowedIn || path.basename(file) !== allowedIn)
        .filter(({ text }) => pattern.test(text))
        .map(({ file }) => file);
      expect(hits).toEqual([]);
    },
  );
});
