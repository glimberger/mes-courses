export interface GitFacts {
  isOnMain(commit: string): Promise<boolean>;
  /** The app version (`app.config.ts`) at `commit`. */
  appVersionAt(commit: string): Promise<string>;
}
