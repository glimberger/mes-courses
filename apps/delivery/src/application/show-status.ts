import {
  ENVIRONMENTS_IN_ORDER,
  ENVIRONMENT_SETTINGS,
} from '../domain/environments';
import type { InstanceState } from '../domain/instance-state';
import type { Environment } from '../domain/manifest';
import type { HealthProbe } from './ports/health-probe';
import { StateCorruptError, type StateStore } from './ports/state-store';

const describeInstance = async (
  deps: { stateStore: StateStore; health: HealthProbe },
  environment: Environment,
): Promise<string> => {
  let state: InstanceState;
  try {
    state = await deps.stateStore.load(environment);
  } catch (error) {
    if (!(error instanceof StateCorruptError)) throw error;
    return `${environment}\n  state unreadable: ${error.message}`;
  }
  // One attempt, no wait: a commit this instance does not have yet is probed as an empty one.
  const health = await deps.health.waitForCommit(
    ENVIRONMENT_SETTINGS[environment].port,
    state.server?.commit ?? '',
    0,
  );
  return [
    environment,
    `  server: ${state.server?.commit ?? 'none'}`,
    `  fdroid: ${state.fdroid?.commit ?? 'none'}`,
    `  failed: ${state.failedCommits.join(', ') || 'none'}`,
    `  last fetch: ${state.lastFetchSuccessAt ?? 'never'}`,
    `  health: ${health}`,
  ].join('\n');
};

/** What runs where: both instances' state and their health, as text (FR-030). */
export const showStatus = async (deps: {
  stateStore: StateStore;
  health: HealthProbe;
}): Promise<string> => {
  const blocks: string[] = [];
  for (const environment of ENVIRONMENTS_IN_ORDER) {
    blocks.push(await describeInstance(deps, environment));
  }
  return blocks.join('\n');
};
