import { parseManifest, type ServerEntry } from '../domain/manifest';
import type { ChannelSource } from './ports/channel-source';
import type { GitFacts } from './ports/git-facts';
import type { SignatureVerifier } from './ports/signature-verifier';

export type FindStagingServerDeps = {
  source: ChannelSource;
  git: GitFacts;
  verifier: SignatureVerifier;
};

export type FetchStagingServerDeps = FindStagingServerDeps & {
  hashFile(file: string): Promise<string>;
};

/**
 * The server entry of the staging manifest that production may reuse for `commit` (ADR-0015).
 *
 * Staging builds the server only when a commit changes it (research R2), so the entry names the
 * commit that last changed the server, not necessarily the tagged one. It is reusable when it is
 * the tagged commit itself, or an ancestor of it with no server change in between. The manifest
 * must carry a valid signature of the deploy key first: its checksum is what the archive is held
 * to, and production re-signs those bytes under its own key. Anything else throws, and there is no fallback: the release stops before it publishes anything.
 */
export const findStagingServer = async (
  { source, git, verifier }: FindStagingServerDeps,
  commit: string,
): Promise<ServerEntry> => {
  const channel = await source.fetchChannel('staging');
  if (channel === null) {
    throw new Error(
      `The staging channel has no manifest, so there is no server archive to promote for ${commit}: deliver the commit to staging first`,
    );
  }
  if (!(await verifier.verify(channel.manifest, channel.signature))) {
    throw new Error(
      `The staging manifest signature does not verify against the allowed signers, so its server archive cannot be trusted for ${commit}`,
    );
  }
  const entry = parseManifest(channel.manifest).server;
  if (entry.commit === commit) return entry;
  if (!(await git.isAncestor(entry.commit, commit))) {
    throw new Error(
      `The staging server archive was built at ${entry.commit}, which is not an ancestor of the tagged commit ${commit}: staging has moved past this commit or never delivered it, so its server archive is no longer available`,
    );
  }
  if (await git.serverChangedBetween(entry.commit, commit)) {
    throw new Error(
      `The server changed between the staging archive (${entry.commit}) and the tagged commit ${commit}, and staging has no archive for it: wait for the staging delivery of ${commit} to build the server`,
    );
  }
  return entry;
};

/** The reason `findStagingServer` refuses `commit`, or null when the archive can be reused. */
export const stagingServerFailure = async (
  deps: FindStagingServerDeps,
  commit: string,
): Promise<string | null> => {
  try {
    await findStagingServer(deps, commit);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
};

/**
 * Finds the staging server archive for `commit`, downloads it to
 * `<destination>/server-<commit>.tar.gz` and checks it against the manifest's SHA-256, so what
 * production publishes is byte-identical to what staging delivered.
 */
export const fetchStagingServer = async (
  deps: FetchStagingServerDeps,
  commit: string,
  destination: string,
): Promise<{ entry: ServerEntry; archive: string }> => {
  const entry = await findStagingServer(deps, commit);
  const archive = `${destination}/server-${commit}.tar.gz`;
  await deps.source.downloadAsset('staging', entry.asset, archive);
  const actual = await deps.hashFile(archive);
  if (actual !== entry.sha256) {
    throw new Error(
      `The staging server archive ${entry.asset} has checksum ${actual}, but the staging manifest says ${entry.sha256}`,
    );
  }
  return { entry, archive };
};
