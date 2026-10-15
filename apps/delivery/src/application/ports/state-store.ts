import type { Environment } from '../../domain/manifest';
import type { InstanceState } from '../../domain/instance-state';

/** The state file exists but cannot be read as a state. */
export class StateCorruptError extends Error {}

export interface StateStore {
  /**
   * The state of the instance; `emptyInstanceState()` when nothing was saved. Throws
   * `StateCorruptError` for a file that cannot be read.
   */
  load(environment: Environment): Promise<InstanceState>;
  /** Moves an unreadable state file aside as `<env>.json.corrupt`. */
  setAside(environment: Environment): Promise<void>;
  save(environment: Environment, state: InstanceState): Promise<void>;
}
