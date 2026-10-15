import { advance, decideDeployment } from '../domain/deployment';
import type { DeploymentStatus, SkipReason } from '../domain/deployment';
import { ENVIRONMENT_SETTINGS } from '../domain/environments';
import {
  clearInFlight,
  markFailed,
  recordSuccess,
  setInFlight,
  type InstanceState,
} from '../domain/instance-state';
import type { Environment, ServerEntry } from '../domain/manifest';
import type { ChannelSource } from './ports/channel-source';
import type { DatabaseSnapshots } from './ports/database-snapshots';
import type { HealthProbe } from './ports/health-probe';
import type { PortOverride } from './ports/port-override';
import type { ReleaseStore } from './ports/release-store';
import type { Reporter } from './ports/reporter';
import type { ServiceManager } from './ports/service-manager';
import type { StateStore } from './ports/state-store';

export type DeployServerDeps = {
  source: ChannelSource;
  releases: ReleaseStore;
  service: ServiceManager;
  ports: PortOverride;
  health: HealthProbe;
  snapshots: DatabaseSnapshots;
  stateStore: StateStore;
  reporter: Reporter;
  /** A writable folder for the archive being downloaded. */
  downloadDir: string;
};

export type DeployOutcome =
  | { kind: 'succeeded' }
  | { kind: 'skipped'; reason: SkipReason }
  /** An error before anything was stopped: the service is untouched (FR-019). */
  | { kind: 'failed'; error: string }
  /**
   * An error after the service was stopped. The rollback is not built yet: the caller reports a
   * critical error and the in-flight record stays in the state for the rollback to find.
   */
  | {
      kind: 'unhandled';
      stage: 'switching' | 'validating' | 'opening';
      error: string;
    };

export type DeployResult = { outcome: DeployOutcome; state: InstanceState };

/** Each health check waits at most this long (research R9). */
export const HEALTH_TIMEOUT_MS = 60_000;

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Deploys one server release on one instance (data-model "Deployment"): install, then stop,
 * copy the database and start on the validation port, then open to the phones once healthy.
 */
export const deployServer = async (
  deps: DeployServerDeps,
  environment: Environment,
  entry: ServerEntry,
  initial: InstanceState,
): Promise<DeployResult> => {
  const decision = decideDeployment(initial, entry);
  if (!decision.deploy) {
    return {
      outcome: { kind: 'skipped', reason: decision.reason },
      state: initial,
    };
  }

  const { port, validationPort } = ENVIRONMENT_SETTINGS[environment];
  const context = { environment, commit: entry.commit };
  let state = initial;
  let status: DeploymentStatus = advance('idle', 'installing');

  try {
    const archive = `${deps.downloadDir}/${entry.asset}`;
    await deps.source.downloadAsset(environment, entry.asset, archive);
    await deps.releases.install(
      environment,
      entry.commit,
      archive,
      entry.sha256,
    );
    await deps.releases.buildRuntime(
      environment,
      entry.commit,
      entry.nixpkgsRev,
    );
  } catch (error) {
    status = advance(status, 'failed');
    state = markFailed(state, entry.commit);
    await deps.stateStore.save(environment, state);
    deps.reporter.report(
      'error',
      `Deployment of ${entry.version} failed before the service was touched: ${messageOf(error)}`,
      context,
    );
    return { outcome: { kind: 'failed', error: messageOf(error) }, state };
  }

  status = advance(status, 'switching');
  let stage: 'switching' | 'validating' | 'opening' = 'switching';
  try {
    state = setInFlight(state, {
      commit: entry.commit,
      previousCommit: initial.server?.commit ?? null,
    });
    await deps.stateStore.save(environment, state);
    await deps.service.stop(environment);
    await deps.snapshots.take(environment, initial.server?.commit ?? null);
    await deps.releases.activate(environment, entry.commit);
    await deps.ports.useValidationPort(environment);
    await deps.service.start(environment);

    status = advance(status, 'validating');
    stage = 'validating';
    const validated = await deps.health.waitForCommit(
      validationPort,
      entry.commit,
      HEALTH_TIMEOUT_MS,
    );
    if (validated !== 'healthy') {
      throw new Error(
        `The new version did not report ${entry.commit} on port ${validationPort} (${validated})`,
      );
    }

    status = advance(status, 'opening');
    stage = 'opening';
    await deps.ports.usePublicPort(environment);
    await deps.service.restart(environment);
    const opened = await deps.health.waitForCommit(
      port,
      entry.commit,
      HEALTH_TIMEOUT_MS,
    );
    if (opened !== 'healthy') {
      throw new Error(
        `The new version did not report ${entry.commit} on port ${port} (${opened})`,
      );
    }
  } catch (error) {
    state = markFailed(state, entry.commit);
    await deps.stateStore.save(environment, state);
    deps.reporter.report(
      'critical',
      `Deployment of ${entry.version} failed while ${stage}, after the service was stopped: ${messageOf(error)}`,
      context,
    );
    return {
      outcome: { kind: 'unhandled', stage, error: messageOf(error) },
      state,
    };
  }

  advance(status, 'succeeded');
  state = clearInFlight(
    recordSuccess(state, { commit: entry.commit, sequence: entry.sequence }),
  );
  await deps.stateStore.save(environment, state);
  await deps.releases.prune(environment);
  deps.reporter.report('info', `Deployed ${entry.version}`, context);
  return { outcome: { kind: 'succeeded' }, state };
};
