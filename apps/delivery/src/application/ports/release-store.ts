import type { Environment } from '../../domain/manifest';

export interface ReleaseStore {
  /**
   * Checks the archive's SHA-256, then unpacks it into a fresh folder for `commit`. Nothing is
   * unpacked when the checksum differs or a member path is unsafe. Returns the folder.
   */
  install(
    environment: Environment,
    commit: string,
    archive: string,
    sha256: string,
  ): Promise<string>;
  /** The folder of an installed release. */
  path(environment: Environment, commit: string): string;
  /** Points `current` at the release, atomically. */
  activate(environment: Environment, commit: string): Promise<void>;
  /**
   * The release `current` points to: its commit and, when its `build-info.json` has one, its
   * sequence. `null` when nothing is installed.
   */
  currentRelease(
    environment: Environment,
  ): Promise<{ commit: string; sequence: number | null } | null>;
  /** Keeps the current release and the two before it. */
  prune(environment: Environment): Promise<void>;
  /** Builds the Node runtime of the release (`<release>/runtime`). */
  buildRuntime(
    environment: Environment,
    commit: string,
    nixpkgsRev: string,
  ): Promise<void>;
}
