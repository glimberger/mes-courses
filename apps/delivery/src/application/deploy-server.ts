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
import type { DiskSpace } from './ports/disk-space';
import {
  HEALTH_TIMEOUT_MS,
  messageOf,
  rollBackServer,
  type RollbackDeps,
  type RollbackOutcome,
} from './rollback-server';

export type DeployServerDeps = RollbackDeps & {
  source: ChannelSource;
  disk: DiskSpace;
  /** A writable folder for the archive being downloaded. */
  downloadDir: string;
};

export type DeployOutcome =
  | { kind: 'succeeded' }
  | { kind: 'skipped'; reason: SkipReason }
  /** An error before anything was stopped: the service is untouched (FR-019). */
  | { kind: 'failed'; error: string }
  /** A failure after the service was stopped: the previous release and database are back. */
  | Extract<RollbackOutcome, { kind: 'rolled-back' }>
  /** The rollback failed too: the previous version is left under `Restart=always`. */
  | Extract<RollbackOutcome, { kind: 'degraded' }>;

export type DeployResult = { outcome: DeployOutcome; state: InstanceState };

/** The unpacked release and its runtime build, estimated: the archive's size is not in the manifest. */
const RELEASE_ESTIMATE_BYTES = 1024 ** 3;
/** Kept free on top of the release and the database copy (FR-032). */
const FREE_MARGIN_BYTES = 1024 ** 3;

const mebibytes = (bytes: number) => `${Math.floor(bytes / 1024 ** 2)} MiB`;

/**
 * Deploys one server release on one instance (data-model "Deployment"): install, then stop,
 * copy the database and start on the validation port, then open to the phones once healthy.
 */
export const deployServer = async (
  deps: DeployServerDeps,
  environment: Environment,
  entry: ServerEntry,
  initial: InstanceState,
  /** `deploy-file`: an archive already on the disk, so nothing is downloaded. */
  options: { localArchive?: string } = {},
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
    const [free, database] = await Promise.all([
      deps.disk.freeBytes(),
      deps.disk.databaseBytes(environment),
    ]);
    const needed = RELEASE_ESTIMATE_BYTES + database + FREE_MARGIN_BYTES;
    if (free < needed) {
      throw new Error(
        `Not enough free disk space: ${mebibytes(free)} free, ${mebibytes(needed)} needed`,
      );
    }
    const archive =
      options.localArchive ?? `${deps.downloadDir}/${entry.asset}`;
    if (options.localArchive === undefined) {
      await deps.source.downloadAsset(environment, entry.asset, archive);
    }
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
  const inFlight = {
    commit: entry.commit,
    previousCommit: initial.server?.commit ?? null,
    snapshot: null,
  };
  let stage: 'switching' | 'validating' | 'opening' = 'switching';
  try {
    state = setInFlight(state, inFlight);
    await deps.stateStore.save(environment, state);
    await deps.service.stop(environment);
    const snapshot = await deps.snapshots.take(
      environment,
      initial.server?.commit ?? null,
    );
    if (snapshot !== null) {
      state = setInFlight(state, { ...inFlight, snapshot });
      await deps.stateStore.save(environment, state);
    }
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
    advance(status, 'rolling-back');
    return rollBackServer(
      deps,
      environment,
      {
        failedCommit: entry.commit,
        label: entry.version,
        previousCommit: inFlight.previousCommit,
        snapshot: state.inFlight?.snapshot ?? null,
        stage,
        error: messageOf(error),
      },
      state,
    );
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
