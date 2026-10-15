import type { Environment } from '../../domain/manifest';
import type { InstanceState } from '../../domain/instance-state';

export interface StateStore {
  /** The state of the instance; `emptyInstanceState()` when nothing was saved. */
  load(environment: Environment): Promise<InstanceState>;
  save(environment: Environment, state: InstanceState): Promise<void>;
}
