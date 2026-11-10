/** One line of a release: what changed, as written in the commit (English). */
export type ChangelogEntry = {
  text: string;
};

/** One released version, as the Nouveautés screen lists it. */
export type ChangelogRelease = {
  version: string;
  /** The release date, `YYYY-MM-DD`. */
  date: string;
  /** New features ("Nouveautés"). */
  features: readonly ChangelogEntry[];
  /** Bug fixes ("Corrections"). */
  fixes: readonly ChangelogEntry[];
};

/** Where the released changes are read from; the releases are newest first. */
export interface ChangelogSource {
  /** The releases, or none when the changelog is empty, missing or unreadable. */
  read(): readonly ChangelogRelease[];
}
