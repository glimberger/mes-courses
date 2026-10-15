import type { InstanceState } from '../domain/instance-state';
import type { Environment, FdroidEntry } from '../domain/manifest';
import { ENVIRONMENT_SETTINGS } from '../domain/environments';
import type { DeployOutcome } from './deploy-server';
import type { ChannelSource } from './ports/channel-source';
import type { FdroidSite } from './ports/fdroid-site';
import type { HealthProbe } from './ports/health-probe';
import type { Reporter } from './ports/reporter';
import type { StateStore } from './ports/state-store';

export type PublishFdroidDeps = {
  source: ChannelSource;
  site: FdroidSite;
  health: HealthProbe;
  stateStore: StateStore;
  reporter: Reporter;
  downloadDir: string;
};

export type PublishFdroidResult = {
  published: boolean;
  /** True when the swap was attempted and went wrong (the manifest then stays unhandled). */
  failed: boolean;
  state: InstanceState;
};

/** The server in service answers before the repository that advertises the app is swapped. */
const SERVING_CHECK_MS = 10_000;

/**
 * The F-Droid step of a pass (FR-011): a newer repository is swapped in only once the server in
 * service is healthy. A failed server step skips it; a skipped server entry (unchanged, or a
 * commit that failed here) does not.
 */
export const publishFdroid = async (
  deps: PublishFdroidDeps,
  environment: Environment,
  entry: FdroidEntry | null,
  state: InstanceState,
  serverOutcome: DeployOutcome,
): Promise<PublishFdroidResult> => {
  const nothing = { published: false, failed: false, state };
  if (entry === null) return nothing;
  if (state.fdroid !== null && state.fdroid.versionCode >= entry.versionCode) {
    return nothing;
  }
  if (serverOutcome.kind === 'failed' || serverOutcome.kind === 'unhandled') {
    return nothing;
  }
  if (state.server === null) return nothing;

  const serving = await deps.health.waitForCommit(
    ENVIRONMENT_SETTINGS[environment].port,
    state.server.commit,
    SERVING_CHECK_MS,
  );
  if (serving !== 'healthy') return nothing;

  const context = { environment, commit: entry.commit };
  try {
    const archive = `${deps.downloadDir}/${entry.asset}`;
    await deps.source.downloadAsset(environment, entry.asset, archive);
    await deps.site.publish(environment, entry.commit, archive, entry.sha256);
  } catch (error) {
    deps.reporter.report(
      'error',
      `Publishing the F-Droid repository failed: ${error instanceof Error ? error.message : String(error)}`,
      context,
    );
    return { published: false, failed: true, state };
  }
  const next = {
    ...state,
    fdroid: { commit: entry.commit, versionCode: entry.versionCode },
  };
  await deps.stateStore.save(environment, next);
  deps.reporter.report(
    'info',
    `Published the F-Droid repository ${entry.commit}`,
    context,
  );
  return { published: true, failed: false, state: next };
};
