import type {
  ChangelogEntry,
  ChangelogRelease,
  ChangelogSource,
} from '../../application/ports/changelog';
import bundled from '../../changelog/changelog.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toEntries = (value: unknown): ChangelogEntry[] =>
  Array.isArray(value)
    ? value.flatMap((entry: unknown) =>
        isRecord(entry) && typeof entry.text === 'string' && entry.text !== ''
          ? [{ text: entry.text }]
          : [],
      )
    : [];

/** Keeps the releases that have a version and a date; anything else in the file is ignored. */
export const parseChangelog = (data: unknown): ChangelogRelease[] =>
  Array.isArray(data)
    ? data.flatMap((release: unknown) =>
        isRecord(release) &&
        typeof release.version === 'string' &&
        typeof release.date === 'string'
          ? [
              {
                version: release.version,
                date: release.date,
                features: toEntries(release.features),
                fixes: toEntries(release.fixes),
              },
            ]
          : [],
      )
    : [];

/**
 * The changelog the release bump commits, embedded in the app at build time: nothing is fetched.
 * An unreadable file gives no release, never an error.
 */
export class BundledChangelog implements ChangelogSource {
  constructor(private readonly data: unknown = bundled) {}

  read(): readonly ChangelogRelease[] {
    return parseChangelog(this.data);
  }
}
