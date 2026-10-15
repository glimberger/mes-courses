import { advance, type DeploymentStatus } from '../domain/deployment';
import { ENVIRONMENT_SETTINGS } from '../domain/environments';
import {
  clearInFlight,
  markFailed,
  type InstanceState,
} from '../domain/instance-state';
import type { Environment } from '../domain/manifest';
import type { DatabaseSnapshots } from './ports/database-snapshots';
import type { HealthProbe } from './ports/health-probe';
import type { PortOverride } from './ports/port-override';
import type { ReleaseStore } from './ports/release-store';
import type { Reporter } from './ports/reporter';
import type { ServiceManager } from './ports/service-manager';
import type { StateStore } from './ports/state-store';

export type RollbackDeps = {
  releases: ReleaseStore;
  service: ServiceManager;
  ports: PortOverride;
  health: HealthProbe;
  snapshots: DatabaseSnapshots;
  stateStore: StateStore;
  reporter: Reporter;
};

/** Each health check waits at most this long (research R9). */
export const HEALTH_TIMEOUT_MS = 60_000;

export type RollbackStage = 'switching' | 'validating' | 'opening' | 'recovery';

export type RollbackOutcome =
  | { kind: 'rolled-back'; stage: RollbackStage; error: string }
  | { kind: 'degraded'; stage: RollbackStage; error: string };

export type Rollback = {
  /** The commit whose deployment failed. */
  failedCommit: string;
  /** How the failed commit is named in reports. */
  label: string;
  /** The release to go back to; `null` on an instance that had none. */
  previousCommit: string | null;
  /** The database copy taken for this deployment, if any. */
  snapshot: string | null;
  stage: RollbackStage;
  error: string;
};

export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Puts the previous release and database back (data-model "Deployment", `rolling-back`). Ends
 * `rolled-back` when the previous version reports its commit again, `degraded` when it does not:
 * the service is then left running under `Restart=always`, never stopped on purpose (FR-019b).
 */
export const rollBackServer = async (
  deps: RollbackDeps,
  environment: Environment,
  rollback: Rollback,
  initial: InstanceState,
): Promise<{ outcome: RollbackOutcome; state: InstanceState }> => {
  const { port } = ENVIRONMENT_SETTINGS[environment];
  const { failedCommit, label, previousCommit, snapshot, stage, error } =
    rollback;
  const context = { environment, commit: failedCommit };
  let status: DeploymentStatus = 'idle';
  // A service this rollback stopped is always started again (FR-019b), whatever failed after.
  let stopped = false;

  // Whatever the outcome, the failed commit is never retried and nothing stays in flight.
  const settle = async () => {
    const state = clearInFlight(markFailed(initial, failedCommit));
    await deps.stateStore.save(environment, state);
    return state;
  };

  try {
    if (previousCommit === null) {
      throw new Error('There is no previous release to go back to');
    }
    status = advance(status, 'rolling-back');
    await deps.service.stop(environment);
    stopped = true;
    if (snapshot !== null) await deps.snapshots.restore(environment, snapshot);
    await deps.releases.activate(environment, previousCommit);
    await deps.ports.usePublicPort(environment);
    await deps.service.start(environment);
    const health = await deps.health.waitForCommit(
      port,
      previousCommit,
      HEALTH_TIMEOUT_MS,
    );
    if (health !== 'healthy') {
      throw new Error(
        `The previous version did not report ${previousCommit} on port ${port} (${health})`,
      );
    }
  } catch (rollbackError) {
    if (stopped) {
      try {
        // The switch back may not have happened (the copy could not be restored): put the
        // previous release behind the public port anyway, so the instance does not stay down.
        await deps.releases.activate(environment, previousCommit as string);
        await deps.ports.usePublicPort(environment);
        await deps.service.start(environment);
      } catch {
        // Restart=always keeps trying; the critical report below tells the maintainer.
      }
    }
    const state = await settle();
    deps.reporter.report(
      'critical',
      `Deployment of ${label} failed (${error}) and the rollback failed too: ${messageOf(rollbackError)}. The instance is left degraded.`,
      context,
    );
    return { outcome: { kind: 'degraded', stage, error }, state };
  }

  advance(status, 'rolled-back');
  const state = await settle();
  deps.reporter.report(
    'error',
    `Deployment of ${label} failed while ${stage} and was rolled back to ${previousCommit}: ${error}`,
    context,
  );
  return { outcome: { kind: 'rolled-back', stage, error }, state };
};
