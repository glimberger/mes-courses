import { parseManifest } from '../domain/manifest';
import { evaluateRelease } from '../domain/release-rules';
import { stagingServerFailure } from './find-staging-server';
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
 * list means the release may go ahead. The staging server archive production will reuse
 * (ADR-0015) is one of the rules, so a release without it stops here, before the Android build. An unreadable production manifest is an error, not a
 * pass, so a broken channel never lets a lower version through.
 */
export const releaseGate = async (
  { git, runs, source }: ReleaseGateDeps,
  input: { tag: string; commit: string },
): Promise<string[]> => {
  const [appVersion, onMain, successfulWorkflows, channel, stagingFailure] =
    await Promise.all([
      git.appVersionAt(input.commit),
      git.isOnMain(input.commit),
      runs.successfulWorkflows(input.commit),
      source.fetchChannel('production'),
      stagingServerFailure({ git, source }, input.commit),
    ]);
  const failures = evaluateRelease({
    tag: input.tag,
    appVersion,
    onMain,
    successfulWorkflows,
    productionVersion:
      channel === null ? null : parseManifest(channel.manifest).version,
  });
  return stagingFailure === null ? failures : [...failures, stagingFailure];
};
