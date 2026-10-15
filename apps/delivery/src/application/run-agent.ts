import { ENVIRONMENTS_IN_ORDER } from '../domain/environments';
import {
  clearSignatureMismatches,
  handledManifest,
  recordFetch,
  recordSignatureMismatch,
  type InstanceState,
} from '../domain/instance-state';
import { parseManifest, type Environment } from '../domain/manifest';
import { compareSemver } from '../domain/semver';
import { deployServer, type DeployServerDeps } from './deploy-server';
import { ChannelSourceError } from './ports/channel-source';
import type { Clock } from './ports/clock';
import type { SignatureVerifier } from './ports/signature-verifier';
import { publishFdroid, type PublishFdroidDeps } from './publish-fdroid';

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

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
  let state: InstanceState = await deps.stateStore.load(environment);

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
  const clean = kind !== 'failed' && kind !== 'unhandled' && !fdroid.failed;
  if (clean) state = handledManifest(state, manifest.sequence);
  await deps.stateStore.save(environment, state);
  if (kind === 'unhandled') return done('failed', true);
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
  return result;
};
