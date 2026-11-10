/**
 * The changelog of a release (feature 014): the section built from git-cliff's context, and its
 * two renderings, `CHANGELOG.md` and `changelog.json`, which carry the same data.
 */

export type ChangelogEntry = {
  /** The commit subject without its `type(scope):` prefix and without a trailing `(#N)`. */
  text: string;
  /** The pull request number of a trailing `(#N)`, else null. */
  pr: number | null;
};

export type ChangelogSection = {
  /** `X.Y.Z`, without the `v`. */
  version: string;
  /** `YYYY-MM-DD`. */
  date: string;
  features: ChangelogEntry[];
  fixes: ChangelogEntry[];
  performances: ChangelogEntry[];
  breaking: ChangelogEntry[];
};

type Group = 'features' | 'fixes' | 'performances' | 'breaking';

/** Rendering order and French titles of the groups. */
const GROUPS: readonly { key: Group; title: string }[] = [
  { key: 'breaking', title: 'Changements incompatibles' },
  { key: 'features', title: 'Nouveautés' },
  { key: 'fixes', title: 'Corrections' },
  { key: 'performances', title: 'Performances' },
];

/**
 * Base of the pull request links. git-cliff's context has no remote URL unless a remote is
 * configured in `cliff.toml`, and the repository is a single, fixed one.
 */
export const REPOSITORY_URL = 'https://github.com/glimberger/mes-courses';

const TITLE = '# Changelog';
const NO_CHANGES = 'No user-facing changes.';
const TRAILING_PR = /\s*\(#(\d+)\)$/;
const SECTION_HEADING = /^## \[([^\]]*)\]/;

const isGroup = (group: unknown): group is Group =>
  GROUPS.some(({ key }) => key === group);

const notAContext = (why: string) =>
  new Error(`Not a git-cliff context: ${why}`);

const toEntry = (message: string): ChangelogEntry => {
  const subject = message.split('\n')[0]?.trim() ?? '';
  const match = TRAILING_PR.exec(subject);
  if (match === null) return { text: subject, pr: null };
  return { text: subject.slice(0, match.index), pr: Number(match[1]) };
};

/**
 * The section of `version`, dated `date`, from the output of `git cliff --context`: an array
 * holding at most one release, whose commits carry the group set by `cliff.toml`.
 */
export const parseContext = (
  json: string,
  version: string,
  date: string,
): ChangelogSection => {
  let releases: unknown;
  try {
    releases = JSON.parse(json);
  } catch {
    throw notAContext('the output is not JSON');
  }
  if (!Array.isArray(releases)) throw notAContext('expected an array');
  const section: ChangelogSection = {
    version,
    date,
    features: [],
    fixes: [],
    performances: [],
    breaking: [],
  };
  for (const release of releases as unknown[]) {
    const commits = (release as { commits?: unknown }).commits;
    if (!Array.isArray(commits)) throw notAContext('a release has no commits');
    for (const commit of commits as unknown[]) {
      const { message, group } = commit as {
        message?: unknown;
        group?: unknown;
      };
      if (typeof message !== 'string')
        throw notAContext('a commit has no message');
      if (!isGroup(group))
        throw new Error(
          `Unknown changelog group ${JSON.stringify(group)}: check cliff.toml`,
        );
      section[group].push(toEntry(message));
    }
  }
  return section;
};

const escapeMarkdown = (text: string) => text.replace(/[\\*_[\]<>]/g, '\\$&');

/** Escapes the markdown characters outside the code spans, which are kept as written. */
const escapeOutsideCode = (text: string) =>
  text
    .split(/(`[^`]*`)/)
    .map((part) => (part.startsWith('`') ? part : escapeMarkdown(part)))
    .join('');

const renderEntry = ({ text, pr }: ChangelogEntry) =>
  pr === null
    ? `- ${escapeOutsideCode(text)}`
    : `- ${escapeOutsideCode(text)} ([#${pr}](${REPOSITORY_URL}/pull/${pr}))`;

/** The `## [X.Y.Z] - date` block, ending with a newline. */
export const renderMarkdownSection = (section: ChangelogSection): string => {
  const blocks = [`## [${section.version}] - ${section.date}`];
  for (const { key, title } of GROUPS) {
    if (section[key].length === 0) continue;
    blocks.push(`### ${title}`, section[key].map(renderEntry).join('\n'));
  }
  if (blocks.length === 1) blocks.push(NO_CHANGES);
  return `${blocks.join('\n\n')}\n`;
};

/** The whole `CHANGELOG.md`, the sections in the given order (newest first). */
export const renderDocument = (sections: ChangelogSection[]): string =>
  [`${TITLE}\n`, ...sections.map(renderMarkdownSection)].join('\n');

/**
 * `document` with the section of `section.version` replaced, or inserted above the others when
 * the version is not there yet; a missing or empty document becomes a new one.
 */
export const upsertMarkdown = (
  document: string,
  section: ChangelogSection,
): string => {
  if (document.trim() === '') return renderDocument([section]);
  const lines = document.split('\n');
  const starts = lines.flatMap((line, index) =>
    SECTION_HEADING.test(line) ? [index] : [],
  );
  const preamble = lines
    .slice(0, starts[0] ?? lines.length)
    .join('\n')
    .trimEnd();
  const blocks = starts.map((start, i) =>
    lines
      .slice(start, starts[i + 1] ?? lines.length)
      .join('\n')
      .trimEnd(),
  );
  const rendered = renderMarkdownSection(section).trimEnd();
  const same = blocks.findIndex(
    (block) => SECTION_HEADING.exec(block)?.[1] === section.version,
  );
  if (same === -1) blocks.unshift(rendered);
  else blocks[same] = rendered;
  return `${[preamble, ...blocks].join('\n\n')}\n`;
};

/** `sections` with the entry of `section.version` replaced in place, or `section` put first. */
export const upsertSection = (
  sections: ChangelogSection[],
  section: ChangelogSection,
): ChangelogSection[] =>
  sections.some(({ version }) => version === section.version)
    ? sections.map((existing) =>
        existing.version === section.version ? section : existing,
      )
    : [section, ...sections];

/** The text of `changelog.json`: two-space JSON and a final newline. */
export const serializeData = (sections: ChangelogSection[]): string =>
  `${JSON.stringify(sections, null, 2)}\n`;
