import type { Environment } from '../domain/manifest';
import {
  deployServer,
  type DeployOutcome,
  type DeployServerDeps,
} from './deploy-server';

export type DeployFileDeps = Omit<DeployServerDeps, 'source'> & {
  hashFile(file: string): Promise<string>;
};

/**
 * No manifest says which nixpkgs revision built the runtime, so a local deployment follows the
 * channel: the runtime is the Node of this branch.
 */
export const LOCAL_NIXPKGS_REF = 'nixos-unstable';

/** The last path segment: the application layer does not import `node:path`. */
const basename = (file: string) => file.split('/').pop() ?? file;

const ARCHIVE_NAME = /^server-([0-9a-f]{40})\.tar\.gz$/;

/**
 * Deploys a server archive from the disk through the same install, validation and rollback path
 * as a delivery, without a manifest or a signature: the one documented exception to FR-017.
 * Only root on the Pi can run it. The sequence is the one in service plus one, so the deployment
 * counts as newer, but it is not kept: the next real delivery, whose sequence counts the commits
 * of `main`, must not be skipped as "not newer" because of it.
 */
export const deployFile = async (
  deps: DeployFileDeps,
  environment: Environment,
  file: string,
): Promise<DeployOutcome> => {
  const commit = ARCHIVE_NAME.exec(basename(file))?.[1];
  if (commit === undefined) {
    throw new Error(`${basename(file)} is not named server-<40 hex>.tar.gz`);
  }
  const state = await deps.stateStore.load(environment);
  const { outcome } = await deployServer(
    {
      ...deps,
      source: {
        fetchChannel: () =>
          Promise.reject(new Error('deploy-file reads no channel')),
        downloadAsset: () =>
          Promise.reject(new Error('deploy-file downloads nothing')),
      },
    },
    environment,
    {
      commit,
      sequence: (state.server?.sequence ?? 0) + 1,
      version: `local-${commit.slice(0, 7)}`,
      asset: basename(file),
      sha256: await deps.hashFile(file),
      nixpkgsRev: LOCAL_NIXPKGS_REF,
    },
    state,
    { localArchive: file },
  );
  if (outcome.kind === 'succeeded' && state.server !== null) {
    const deployed = await deps.stateStore.load(environment);
    if (deployed.server !== null) {
      await deps.stateStore.save(environment, {
        ...deployed,
        server: { ...deployed.server, sequence: state.server.sequence },
      });
    }
  }
  return outcome;
};
