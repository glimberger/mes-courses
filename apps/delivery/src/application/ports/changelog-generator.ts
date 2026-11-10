import type { ChangelogSection } from '../../domain/changelog';

export interface ChangelogGenerator {
  /**
   * The changelog section of `version`, dated `date` (`YYYY-MM-DD`), from the commits of
   * `origin/main` since the last `vX.Y.Z` tag. Throws with the reason when the tool is missing
   * or its configuration is wrong.
   */
  generate(version: string, date: string): Promise<ChangelogSection>;
}
