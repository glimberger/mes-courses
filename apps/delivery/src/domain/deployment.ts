import type { InstanceState } from './instance-state';
import type { ServerEntry } from './manifest';

/** The steps of one server deployment on one instance (data-model "Deployment"). */
export type DeploymentStatus =
  | 'idle'
  | 'installing'
  | 'switching'
  | 'validating'
  | 'opening'
  | 'succeeded'
  | 'failed';

const FORWARD: Record<DeploymentStatus, DeploymentStatus[]> = {
  idle: ['installing'],
  // An install error ends `failed` with nothing stopped.
  installing: ['switching', 'failed'],
  switching: ['validating'],
  validating: ['opening'],
  opening: ['succeeded'],
  succeeded: [],
  failed: [],
};

/** The next status, or an error when the data-model's diagram has no such arrow. */
export const advance = (
  from: DeploymentStatus,
  to: DeploymentStatus,
): DeploymentStatus => {
  if (!FORWARD[from].includes(to)) {
    throw new Error(`A deployment cannot go from ${from} to ${to}`);
  }
  return to;
};

export type SkipReason = 'failed-before' | 'not-newer';

/** Whether the server entry is to be deployed on an instance in this state. */
export const decideDeployment = (
  state: InstanceState,
  entry: ServerEntry,
): { deploy: true } | { deploy: false; reason: SkipReason } => {
  if (state.failedCommits.includes(entry.commit)) {
    return { deploy: false, reason: 'failed-before' };
  }
  if (state.server !== null && entry.sequence <= state.server.sequence) {
    return { deploy: false, reason: 'not-newer' };
  }
  return { deploy: true };
};
