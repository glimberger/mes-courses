import type { CommandRunner } from '../../application/ports/command-runner';
import type {
  AgentRelease,
  AgentReleases,
} from '../../application/ports/agent-update';
import { compareSemver } from '../../domain/semver';
import { createGh } from './gh';

type GhRelease = {
  tag_name: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { id: number; name: string }[];
};

const TAG = /^v(\d+\.\d+\.\d+)$/;
const ASSET = /^delivery-(\d+\.\d+\.\d+)\.tar\.gz$/;

const releaseOf = (release: GhRelease): AgentRelease => {
  const asset = release.assets?.find((candidate) => ASSET.test(candidate.name));
  if (asset === undefined) {
    throw new Error(
      `Release ${release.tag_name} has no delivery-<version>.tar.gz asset`,
    );
  }
  return {
    tag: release.tag_name,
    agentVersion: (ASSET.exec(asset.name) as RegExpExecArray)[1] as string,
    assetId: asset.id,
    assetName: asset.name,
  };
};

/**
 * The agent bundles of the repository's releases (`vX.Y.Z`), read with the maintainer's `gh`
 * session in the repository at `cwd`. The channel releases (`channel-*`) are never candidates.
 */
export const createGithubAgentReleases = (
  runner: CommandRunner,
  cwd: string,
): AgentReleases => {
  const gh = createGh(runner, cwd);
  return {
    resolve: async (version) => {
      if (version !== undefined) {
        const release = JSON.parse(
          await gh(['api', `repos/{owner}/{repo}/releases/tags/v${version}`]),
        ) as GhRelease;
        return releaseOf(release);
      }
      const all = JSON.parse(
        await gh(['api', 'repos/{owner}/{repo}/releases?per_page=100']),
      ) as GhRelease[];
      const latest = all
        .filter(
          (release) =>
            TAG.test(release.tag_name) && !release.draft && !release.prerelease,
        )
        .sort((a, b) =>
          compareSemver(
            (TAG.exec(b.tag_name) as RegExpExecArray)[1] as string,
            (TAG.exec(a.tag_name) as RegExpExecArray)[1] as string,
          ),
        )[0];
      if (latest === undefined) throw new Error('No release found');
      return releaseOf(latest);
    },
  };
};
