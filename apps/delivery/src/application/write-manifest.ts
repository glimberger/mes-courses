import {
  parseManifest,
  type ChannelManifest,
  type Environment,
  type FdroidEntry,
  type ServerEntry,
} from '../domain/manifest';
import { parseSemver } from '../domain/semver';
import type { ChannelPublisher } from './ports/channel-publisher';
import type { ChannelSource } from './ports/channel-source';
import type { Clock } from './ports/clock';
import type { Signer } from './ports/signer';

/** A built archive: where it is, and its SHA-256 (computed by the caller, which owns the file). */
export type BuiltAsset = { path: string; sha256: string };

export type WriteManifestInput = {
  environment: Environment;
  commit: string;
  sequence: number;
  /** `X.Y.Z`: the tag's version in production, the base of `X.Y.Z-staging.<n>` in staging. */
  version: string;
  nixpkgsRev: string;
  minAgentVersion: string;
  run: { id: number; url: string };
  /** Present when this run built the server. */
  server?: BuiltAsset | undefined;
  /** Present when this run built the Android repository. */
  fdroid?: BuiltAsset | undefined;
};

export type WriteManifestDeps = {
  source: ChannelSource;
  publisher: ChannelPublisher;
  signer: Signer;
  clock: Clock;
};

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

const assetsOf = (manifest: ChannelManifest): string[] =>
  [manifest.server.asset, manifest.fdroid?.asset].filter(
    (asset): asset is string => asset !== undefined,
  );

/**
 * Writes a channel's manifest (contracts/channel-manifest.md, "Writing rules"): the current
 * manifest with the entries of the targets this run built replaced, signed, and published
 * assets first, signature second, manifest last.
 */
export const writeManifest = async (
  deps: WriteManifestDeps,
  input: WriteManifestInput,
): Promise<ChannelManifest> => {
  const { environment, commit, sequence } = input;
  if (parseSemver(input.version).staging !== null) {
    throw new Error(`--version must be X.Y.Z, got ${input.version}`);
  }
  if (!input.server && !input.fdroid) {
    throw new Error('Nothing to publish: no server and no Android repository');
  }

  const files = await deps.source.fetchChannel(environment);
  const current = files ? parseManifest(files.manifest) : null;
  if (!current && !input.server) {
    throw new Error(
      `The first manifest of the ${environment} channel needs a server`,
    );
  }

  if (
    current &&
    (sequence < current.sequence ||
      (sequence === current.sequence && commit !== current.commit))
  ) {
    throw new Error(
      `The ${environment} channel is already at sequence ${current.sequence} (${current.commit}): ${commit} at ${sequence} is older`,
    );
  }

  const versionOf = (at: number) =>
    environment === 'production'
      ? input.version
      : `${input.version}-staging.${at}`;

  const server: ServerEntry = input.server
    ? {
        commit,
        sequence,
        version: versionOf(sequence),
        asset: basename(input.server.path),
        sha256: input.server.sha256,
        nixpkgsRev: input.nixpkgsRev,
      }
    : (current as ChannelManifest).server;
  const fdroid: FdroidEntry | null = input.fdroid
    ? {
        commit,
        versionCode: sequence,
        asset: basename(input.fdroid.path),
        sha256: input.fdroid.sha256,
      }
    : (current?.fdroid ?? null);

  const manifest: ChannelManifest = {
    schema: 1,
    environment,
    sequence,
    commit,
    version: versionOf(sequence),
    createdAt: new Date(deps.clock.nowMs()).toISOString(),
    run: input.run,
    minAgentVersion: input.minAgentVersion,
    server,
    fdroid,
  };
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  parseManifest(json);

  for (const built of [input.server, input.fdroid]) {
    if (built) await deps.publisher.uploadAsset(environment, built.path);
  }
  await deps.publisher.uploadSignature(
    environment,
    await deps.signer.sign(json),
  );
  await deps.publisher.uploadManifest(environment, json);
  await deps.publisher.prune(environment, [
    ...assetsOf(manifest),
    ...(current ? assetsOf(current) : []),
  ]);
  return manifest;
};
