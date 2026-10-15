import type { Environment } from '../../domain/manifest';

export interface FdroidSite {
  /** Checks the archive, unpacks it and swaps the served repository atomically. */
  publish(
    environment: Environment,
    commit: string,
    archive: string,
    sha256: string,
  ): Promise<void>;
}
