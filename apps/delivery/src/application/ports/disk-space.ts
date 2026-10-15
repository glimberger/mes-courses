import type { Environment } from '../../domain/manifest';

/** What the disk check of FR-032 needs to know. */
export interface DiskSpace {
  /** Free bytes on the volume that holds the releases. */
  freeBytes(): Promise<number>;
  /** Size of the instance's database, `-wal` and `-shm` included; 0 when there is none. */
  databaseBytes(environment: Environment): Promise<number>;
}
