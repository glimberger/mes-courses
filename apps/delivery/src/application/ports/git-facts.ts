export interface GitFacts {
  isOnMain(commit: string): Promise<boolean>;
  /** The app version (`app.config.ts`) at `commit`. */
  appVersionAt(commit: string): Promise<string>;
  /** Whether `base` is `head` or one of its ancestors. */
  isAncestor(base: string, head: string): Promise<boolean>;
  /**
   * Whether the files changed from `base` to `head` affect the server archive, by the same rules
   * as the staging delivery plan (`.github/scripts/delivery-targets.sh`).
   */
  serverChangedBetween(base: string, head: string): Promise<boolean>;
}
