import { ENVIRONMENTS_IN_ORDER } from '../domain/environments';
import {
  clearSignatureMismatches,
  emptyInstanceState,
  handledManifest,
  recordFetch,
  recordSignatureMismatch,
  type InstanceState,
} from '../domain/instance-state';
import { parseManifest, type Environment } from '../domain/manifest';
import { compareSemver } from '../domain/semver';
import { deployServer, type DeployServerDeps } from './deploy-server';
import { ChannelSourceError } from './ports/channel-source';
import { StateCorruptError } from './ports/state-store';
import type { Clock } from './ports/clock';
import type { SignatureVerifier } from './ports/signature-verifier';
import { publishFdroid, type PublishFdroidDeps } from './publish-fdroid';
import { messageOf, rollBackServer } from './rollback-server';

export type RunAgentDeps = Omit<DeployServerDeps, 'downloadDir'> &
  Omit<PublishFdroidDeps, 'downloadDir'> & {
    verifier: SignatureVerifier;
    clock: Clock;
    downloadDir: string;
    /** `apps/delivery`'s own version, compared with a manifest's `minAgentVersion`. */
    agentVersion: string;
  };

export type EnvironmentStatus =
  | 'no-channel'
  | 'fetch-failed'
  | 'refused'
  | 'unchanged'
  | 'deployed'
  | 'failed'
  | 'error';

export type RunResult = {
  environments: Partial<Record<Environment, { status: EnvironmentStatus }>>;
  /** A deployment broke an instance that could not be put back: the exit code says so. */
  degraded: boolean;
};

/** Signature mismatches are reported from this pass on (contract "Upload order"). */
const MISMATCHES_BEFORE_REPORT = 3;

/**
 * One pass over an environment (research R6): read the channel, verify, and bring the instance to
 * the manifest. Returns the status of the pass and whether the instance was left degraded.
 */
const handleEnvironment = async (
  deps: RunAgentDeps,
  environment: Environment,
): Promise<{ status: EnvironmentStatus; degraded: boolean }> => {
  const done = (status: EnvironmentStatus, degraded = false) => ({
    status,
    degraded,
  });
  const context = { environment };
  let state: InstanceState;
  try {
    state = await deps.stateStore.load(environment);
  } catch (error) {
    if (!(error instanceof StateCorruptError)) throw error;
    await deps.stateStore.setAside(environment);
    state = emptyInstanceState();
    deps.reporter.report(
      'error',
      `The ${environment} state file was unreadable and was moved aside as ${environment}.json.corrupt`,
      context,
    );
  }

  // FR-033: an instance that already runs a release keeps running it without its state file.
  if (state.server === null) {
    const current = await deps.releases.currentRelease(environment);
    if (current !== null) {
      state = {
        ...state,
        server: { commit: current.commit, sequence: current.sequence ?? 0 },
      };
      await deps.stateStore.save(environment, state);
      deps.reporter.report(
        'error',
        `The ${environment} state had no server release; rebuilt it from the installed release ${current.commit}`,
        { ...context, commit: current.commit },
      );
    }
  }

  // The agent or the Pi died during a deployment: put the previous version back first (R6).
  if (state.inFlight !== null) {
    const { commit, previousCommit, snapshot } = state.inFlight;
    const recovered = await rollBackServer(
      deps,
      environment,
      {
        failedCommit: commit,
        label: commit,
        previousCommit,
        snapshot,
        stage: 'recovery',
        error: 'The agent or the Pi stopped during the deployment',
      },
      state,
    );
    state = recovered.state;
    if (recovered.outcome.kind === 'degraded') return done('failed', true);
  }

  let files;
  try {
    files = await deps.source.fetchChannel(environment);
  } catch (error) {
    deps.reporter.report(
      'error',
      `Reading the ${environment} channel failed: ${messageOf(error)}` +
        (error instanceof ChannelSourceError &&
        (error.status === 401 || error.status === 403)
          ? ' (check the read-only token)'
          : ''),
      context,
    );
    return done('fetch-failed');
  }
  state = recordFetch(state, new Date(deps.clock.nowMs()).toISOString());
  if (files === null) {
    await deps.stateStore.save(environment, state);
    return done('no-channel');
  }

  if (!(await deps.verifier.verify(files.manifest, files.signature))) {
    state = recordSignatureMismatch(state);
    await deps.stateStore.save(environment, state);
    if (state.signatureMismatches >= MISMATCHES_BEFORE_REPORT) {
      deps.reporter.report(
        'error',
        `The ${environment} manifest signature has not verified for ${state.signatureMismatches} passes`,
        context,
      );
    }
    return done('refused');
  }
  state = clearSignatureMismatches(state);

  const refuse = async (message: string) => {
    await deps.stateStore.save(environment, state);
    deps.reporter.report('error', message, context);
    return done('refused');
  };

  let manifest;
  try {
    manifest = parseManifest(files.manifest);
  } catch (error) {
    return refuse(
      `The ${environment} manifest is invalid: ${messageOf(error)}`,
    );
  }
  if (manifest.environment !== environment) {
    return refuse(
      `The ${environment} channel holds a manifest for the ${manifest.environment} environment`,
    );
  }
  if (compareSemver(manifest.minAgentVersion, deps.agentVersion) > 0) {
    return refuse(
      `The ${environment} manifest needs agent ${manifest.minAgentVersion} or newer; this is ${deps.agentVersion}`,
    );
  }
  if (
    state.manifestSequence !== null &&
    manifest.sequence <= state.manifestSequence
  ) {
    await deps.stateStore.save(environment, state);
    return done('unchanged');
  }

  const server = await deployServer(deps, environment, manifest.server, state);
  const fdroid = await publishFdroid(
    deps,
    environment,
    manifest.fdroid,
    server.state,
    server.outcome,
  );
  state = fdroid.state;

  const kind = server.outcome.kind;
  const clean =
    kind !== 'failed' &&
    kind !== 'rolled-back' &&
    kind !== 'degraded' &&
    !fdroid.failed &&
    !fdroid.pending;
  if (clean) state = handledManifest(state, manifest.sequence);
  await deps.stateStore.save(environment, state);
  if (kind === 'degraded') return done('failed', true);
  if (!clean) return done('failed');
  return done(
    kind === 'succeeded' || fdroid.published ? 'deployed' : 'unchanged',
  );
};

/**
 * One pass of the agent: staging, then production, one after the other. A problem in one
 * environment never stops the other.
 */
export const runAgent = async (
  deps: RunAgentDeps,
  options: { only?: Environment } = {},
): Promise<RunResult> => {
  const result: RunResult = { environments: {}, degraded: false };
  const environments = options.only ? [options.only] : ENVIRONMENTS_IN_ORDER;
  for (const environment of environments) {
    try {
      const { status, degraded } = await handleEnvironment(deps, environment);
      result.environments[environment] = { status };
      if (degraded) result.degraded = true;
    } catch (error) {
      deps.reporter.report(
        'error',
        `The ${environment} pass stopped on an unexpected error: ${messageOf(error)}`,
        { environment },
      );
      result.environments[environment] = { status: 'error' };
    }
  }
  deps.reporter.checkIn(result.degraded ? 'error' : 'ok');
  return result;
};
