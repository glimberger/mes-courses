import { parseManifest } from '../domain/manifest';
import { evaluateRelease } from '../domain/release-rules';
import type { ChannelSource } from './ports/channel-source';
import type { GitFacts } from './ports/git-facts';
import type { RunHistory } from './ports/run-history';

export type ReleaseGateDeps = {
  git: GitFacts;
  runs: RunHistory;
  source: ChannelSource;
};

/**
 * Gathers the facts of a release and returns every rule it breaks (research R15); an empty
 * list means the release may go ahead. An unreadable production manifest is an error, not a
 * pass, so a broken channel never lets a lower version through.
 */
export const releaseGate = async (
  { git, runs, source }: ReleaseGateDeps,
  input: { tag: string; commit: string },
): Promise<string[]> => {
  const [appVersion, onMain, successfulWorkflows, channel] = await Promise.all([
    git.appVersionAt(input.commit),
    git.isOnMain(input.commit),
    runs.successfulWorkflows(input.commit),
    source.fetchChannel('production'),
  ]);
  return evaluateRelease({
    tag: input.tag,
    appVersion,
    onMain,
    successfulWorkflows,
    productionVersion:
      channel === null ? null : parseManifest(channel.manifest).version,
  });
};
