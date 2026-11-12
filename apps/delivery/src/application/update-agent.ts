import type {
  AgentHost,
  AgentRelease,
  AgentReleases,
} from './ports/agent-update';
import type { Output } from './ports/output';

export type UpdateAgentDeps = {
  releases: AgentReleases;
  host: AgentHost;
  output: Output;
};

export type UpdateAgentRequest = {
  /** The release to install (`X.Y.Z`); the latest when omitted. */
  version?: string | undefined;
  dryRun: boolean;
};

export type UpdateAgentResult =
  | { outcome: 'installed'; release: AgentRelease; previous: string | null }
  | { outcome: 'unchanged'; release: AgentRelease }
  | { outcome: 'planned'; release: AgentRelease }
  | {
      outcome: 'stopped';
      message: string;
      /** True when `current` already points at the new release. */
      repointed: boolean;
    };

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Installs a release of the agent on the Pi: unpack, build the runtime, and only then repoint
 * `current`. A failure before the repoint leaves `current` as it was; the previous release folder
 * is never removed.
 */
export const updateAgent = async (
  { releases, host, output }: UpdateAgentDeps,
  { version, dryRun }: UpdateAgentRequest,
): Promise<UpdateAgentResult> => {
  let release: AgentRelease;
  let previous: string | null;
  let ready: boolean;
  try {
    release = await releases.resolve(version);
    previous = await host.currentVersion();
    ready = await host.isReady(release.agentVersion);
  } catch (error) {
    return {
      outcome: 'stopped',
      message: `Nothing was changed: ${reason(error)}`,
      repointed: false,
    };
  }
  const target = release.agentVersion;
  const from = previous ?? 'none';
  output.line(
    `Release ${release.tag} carries agent ${target}; the Pi runs ${from}.`,
  );

  if (previous === target && ready) {
    output.line(`Agent ${target} is already installed: nothing to do.`);
    try {
      output.line(await host.status());
    } catch (error) {
      output.line(`Could not read the status: ${reason(error)}`);
    }
    return { outcome: 'unchanged', release };
  }

  if (dryRun) {
    output.line('Dry run, nothing is changed. Would, on the Pi:');
    output.line(
      `  1. download ${release.assetName} (release ${release.tag}) with the token of /etc/mes-courses/agent.env`,
    );
    output.line(
      `  2. unpack it into /opt/mes-courses/agent/releases/${target}/`,
    );
    output.line(
      `  3. build the Node runtime from the bundle's nixpkgs-rev into releases/${target}/runtime`,
    );
    output.line(`  4. point runtime and current at releases/${target}/`);
    output.line('  5. run main.js status');
    return { outcome: 'planned', release };
  }

  try {
    output.line(`Downloading and unpacking ${release.assetName}...`);
    await host.install(release);
    output.line('Building the Node runtime (this can take minutes)...');
    await host.buildRuntime(target);
  } catch (error) {
    return {
      outcome: 'stopped',
      message: `The update failed before switching, \`current\` still points at ${from}: ${reason(error)}`,
      repointed: false,
    };
  }

  try {
    output.line(`Pointing current at ${target}...`);
    await host.activate(target);
  } catch (error) {
    return {
      outcome: 'stopped',
      message: `Could not switch to ${target}, \`current\` is expected to still point at ${from}: ${reason(error)}`,
      repointed: false,
    };
  }

  try {
    output.line(await host.status());
  } catch (error) {
    return {
      outcome: 'stopped',
      message: `Agent ${target} is installed and current points at it, but \`main.js status\` failed: ${reason(error)}. The previous release${previous === null ? '' : ` (releases/${previous})`} is still on disk to point back to.`,
      repointed: true,
    };
  }
  output.line(
    `Agent ${target} installed. Verify on the Pi: the status above, then \`journalctl -u mes-courses-agent -n 50\`.`,
  );
  return { outcome: 'installed', release, previous };
};
