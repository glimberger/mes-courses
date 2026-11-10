import {
  type ChangelogSection,
  parseContext,
  renderDocument,
  renderMarkdownSection,
  REPOSITORY_URL,
  serializeData,
  upsertMarkdown,
  upsertSection,
} from './changelog';

const PULL = `${REPOSITORY_URL}/pull`;

const commit = (message: string, group: string, breaking = false) => ({
  message,
  group,
  breaking,
  raw_message: `whatever: ${message}`,
});

const context = (commits: ReturnType<typeof commit>[]) =>
  JSON.stringify([{ version: 'v9.9.9', commits }]);

const section = (
  version: string,
  fields: Partial<ChangelogSection> = {},
): ChangelogSection => ({
  version,
  date: '2026-11-10',
  features: [],
  fixes: [],
  performances: [],
  breaking: [],
  ...fields,
});

describe('parseContext', () => {
  it('sorts the commits into their group, named for the released version and date', () => {
    const parsed = parseContext(
      context([
        commit('add dark mode', 'features'),
        commit('keep the quantity on sync', 'fixes'),
        commit('faster list', 'performances'),
        commit('drop node 22', 'breaking', true),
      ]),
      '2.2.0',
      '2026-11-10',
    );
    expect(parsed).toEqual({
      version: '2.2.0',
      date: '2026-11-10',
      features: [{ text: 'add dark mode', pr: null }],
      fixes: [{ text: 'keep the quantity on sync', pr: null }],
      performances: [{ text: 'faster list', pr: null }],
      breaking: [{ text: 'drop node 22', pr: null }],
    });
  });

  it('takes the pull request number out of a trailing (#N)', () => {
    const parsed = parseContext(
      context([commit('add dark mode (#123)', 'features')]),
      '2.2.0',
      '2026-11-10',
    );
    expect(parsed.features).toEqual([{ text: 'add dark mode', pr: 123 }]);
  });

  it('keeps a (#N) that is not at the end of the subject as text', () => {
    const parsed = parseContext(
      context([commit('fix (#12) in the middle', 'fixes')]),
      '2.2.0',
      '2026-11-10',
    );
    expect(parsed.fixes).toEqual([
      { text: 'fix (#12) in the middle', pr: null },
    ]);
  });

  it('lists a breaking commit only under breaking, never in its type group', () => {
    const parsed = parseContext(
      context([commit('new storage', 'breaking', true)]),
      '3.0.0',
      '2026-11-10',
    );
    expect(parsed.features).toEqual([]);
    expect(parsed.breaking).toEqual([{ text: 'new storage', pr: null }]);
  });

  it('gives a section with four empty groups when nothing is left after filtering', () => {
    expect(parseContext(context([]), '2.2.0', '2026-11-10')).toEqual(
      section('2.2.0'),
    );
    expect(parseContext('[]', '2.2.0', '2026-11-10')).toEqual(section('2.2.0'));
  });

  it('refuses a commit of a group the changelog does not know', () => {
    expect(() =>
      parseContext(context([commit('x', 'chores')]), '2.2.0', '2026-11-10'),
    ).toThrow(/Unknown changelog group "chores"/);
  });

  it('refuses output that is not a git-cliff context', () => {
    expect(() => parseContext('not json', '2.2.0', '2026-11-10')).toThrow(
      /Not a git-cliff context/,
    );
    expect(() => parseContext('{}', '2.2.0', '2026-11-10')).toThrow(
      /Not a git-cliff context/,
    );
    expect(() =>
      parseContext('[{"commits":[{"message":1}]}]', '2.2.0', '2026-11-10'),
    ).toThrow(/Not a git-cliff context/);
  });
});

describe('renderMarkdownSection', () => {
  it('renders the groups in order with French titles and links to the pull requests', () => {
    expect(
      renderMarkdownSection(
        section('2.2.0', {
          features: [{ text: 'add dark mode', pr: 190 }],
          fixes: [{ text: 'keep the quantity', pr: null }],
          performances: [{ text: 'faster list', pr: 3 }],
          breaking: [{ text: 'drop node 22', pr: 12 }],
        }),
      ),
    ).toBe(
      [
        '## [2.2.0] - 2026-11-10',
        '',
        '### Changements incompatibles',
        '',
        `- drop node 22 ([#12](${PULL}/12))`,
        '',
        '### Nouveautés',
        '',
        `- add dark mode ([#190](${PULL}/190))`,
        '',
        '### Corrections',
        '',
        '- keep the quantity',
        '',
        '### Performances',
        '',
        `- faster list ([#3](${PULL}/3))`,
        '',
      ].join('\n'),
    );
  });

  it('omits the empty groups', () => {
    expect(
      renderMarkdownSection(
        section('2.2.0', { fixes: [{ text: 'a fix', pr: null }] }),
      ),
    ).toBe('## [2.2.0] - 2026-11-10\n\n### Corrections\n\n- a fix\n');
  });

  it('says there is no user-facing change when every group is empty', () => {
    expect(renderMarkdownSection(section('2.2.0'))).toBe(
      '## [2.2.0] - 2026-11-10\n\nNo user-facing changes.\n',
    );
  });

  it('escapes the markdown characters of a subject but keeps its code spans', () => {
    const rendered = renderMarkdownSection(
      section('2.2.0', {
        fixes: [{ text: 'show <b> and [x](y) *as is* in `a_b`', pr: null }],
      }),
    );
    expect(rendered).toContain(
      '- show \\<b\\> and \\[x\\](y) \\*as is\\* in `a_b`\n',
    );
  });
});

describe('renderDocument', () => {
  it('puts the title, then the sections in the given order', () => {
    expect(
      renderDocument([
        section('2.1.0'),
        section('2.0.1', { date: '2026-10-01' }),
      ]),
    ).toBe(
      [
        '# Changelog',
        '',
        '## [2.1.0] - 2026-11-10',
        '',
        'No user-facing changes.',
        '',
        '## [2.0.1] - 2026-10-01',
        '',
        'No user-facing changes.',
        '',
      ].join('\n'),
    );
  });
});

describe('upsertMarkdown', () => {
  const older = section('2.0.1', {
    date: '2026-10-01',
    fixes: [{ text: 'old fix', pr: 1 }],
  });

  it('creates the document when the file is empty or missing', () => {
    expect(upsertMarkdown('', section('2.1.0'))).toBe(
      renderDocument([section('2.1.0')]),
    );
  });

  it('inserts a new version above the existing ones', () => {
    const document = renderDocument([older]);
    expect(upsertMarkdown(document, section('2.1.0'))).toBe(
      renderDocument([section('2.1.0'), older]),
    );
  });

  it('replaces the section of the same version instead of adding a second one', () => {
    const stale = section('2.1.0', { fixes: [{ text: 'stale', pr: null }] });
    const fresh = section('2.1.0', { features: [{ text: 'fresh', pr: 2 }] });
    const document = renderDocument([stale, older]);
    expect(upsertMarkdown(document, fresh)).toBe(
      renderDocument([fresh, older]),
    );
    expect(upsertMarkdown(upsertMarkdown(document, fresh), fresh)).toBe(
      renderDocument([fresh, older]),
    );
  });

  it('does not take a longer version for the same one', () => {
    const document = renderDocument([section('2.1.01')]);
    expect(upsertMarkdown(document, section('2.1.0'))).toBe(
      renderDocument([section('2.1.0'), section('2.1.01')]),
    );
  });
});

describe('upsertSection', () => {
  it('puts a new version first', () => {
    expect(upsertSection([section('2.0.1')], section('2.1.0'))).toEqual([
      section('2.1.0'),
      section('2.0.1'),
    ]);
  });

  it('replaces the entry of the same version in place', () => {
    const fresh = section('2.0.1', { fixes: [{ text: 'fresh', pr: null }] });
    expect(upsertSection([section('2.1.0'), section('2.0.1')], fresh)).toEqual([
      section('2.1.0'),
      fresh,
    ]);
  });
});

describe('serializeData', () => {
  it('writes the sections as two-space JSON ending with a newline', () => {
    const text = serializeData([
      section('2.1.0', { features: [{ text: 'say "hi" \\ there', pr: 4 }] }),
    ]);
    expect(text.endsWith('}\n]\n')).toBe(true);
    expect(text).toContain('\n  {\n    "version": "2.1.0",');
    expect(JSON.parse(text)).toEqual([
      section('2.1.0', { features: [{ text: 'say "hi" \\ there', pr: 4 }] }),
    ]);
  });
});
