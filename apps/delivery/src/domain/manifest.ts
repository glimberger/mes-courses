import { parseSemver } from './semver';

export type Environment = 'staging' | 'production';

/** The number of commits reachable from a commit of `main`; also the Android `versionCode`. */
export type Sequence = number;

export type ServerEntry = {
  commit: string;
  sequence: Sequence;
  version: string;
  asset: string;
  sha256: string;
  nixpkgsRev: string;
};

export type FdroidEntry = {
  commit: string;
  versionCode: number;
  asset: string;
  sha256: string;
};

export type ChannelManifest = {
  schema: 1;
  environment: Environment;
  sequence: Sequence;
  commit: string;
  version: string;
  createdAt: string;
  run: { id: number; url: string };
  minAgentVersion: string;
  server: ServerEntry;
  fdroid: FdroidEntry | null;
};

type Json = Record<string, unknown>;

const fail = (field: string, rule: string): never => {
  throw new Error(`Invalid manifest: ${field} ${rule}`);
};

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const object = (value: unknown, field: string): Json =>
  isObject(value) ? value : fail(field, 'must be an object');

const string = (value: unknown, field: string): string =>
  typeof value === 'string' ? value : fail(field, 'must be a string');

const positiveInteger = (value: unknown, field: string): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : fail(field, 'must be a positive integer');

const hex = (value: unknown, field: string, length: number): string => {
  const text = string(value, field);
  return new RegExp(`^[0-9a-f]{${length}}$`).test(text)
    ? text
    : fail(field, `must be ${length} lowercase hex characters`);
};

const ASSET = /^[a-z0-9][a-z0-9.-]*\.tar\.gz$/;

const asset = (value: unknown, field: string): string => {
  const text = string(value, field);
  return ASSET.test(text)
    ? text
    : fail(field, 'is not a plain .tar.gz file name');
};

const version = (value: unknown, field: string): string => {
  const text = string(value, field);
  try {
    parseSemver(text);
  } catch {
    fail(field, 'must be a semver version');
  }
  return text;
};

const parseServer = (value: unknown, sequence: number): ServerEntry => {
  const entry = object(value, 'server');
  const serverSequence = positiveInteger(entry.sequence, 'server.sequence');
  if (serverSequence > sequence)
    fail('server.sequence', 'is above the manifest sequence');
  return {
    commit: hex(entry.commit, 'server.commit', 40),
    sequence: serverSequence,
    version: version(entry.version, 'server.version'),
    asset: asset(entry.asset, 'server.asset'),
    sha256: hex(entry.sha256, 'server.sha256', 64),
    nixpkgsRev: hex(entry.nixpkgsRev, 'server.nixpkgsRev', 40),
  };
};

const parseFdroid = (value: unknown, sequence: number): FdroidEntry | null => {
  if (value === null) return null;
  const entry = object(value, 'fdroid');
  const versionCode = positiveInteger(entry.versionCode, 'fdroid.versionCode');
  if (versionCode > sequence)
    fail('fdroid.versionCode', 'is above the manifest sequence');
  return {
    commit: hex(entry.commit, 'fdroid.commit', 40),
    versionCode,
    asset: asset(entry.asset, 'fdroid.asset'),
    sha256: hex(entry.sha256, 'fdroid.sha256', 64),
  };
};

/** Parses and validates a channel manifest (data-model "ChannelManifest"); throws on any breach. */
export const parseManifest = (json: string): ChannelManifest => {
  const raw = object(JSON.parse(json), 'manifest');
  if (raw.schema !== 1) fail('schema', 'must be 1');
  const environment = raw.environment;
  if (environment !== 'staging' && environment !== 'production') {
    fail('environment', 'must be staging or production');
  }
  const sequence = positiveInteger(raw.sequence, 'sequence');
  const manifestVersion = version(raw.version, 'version');
  const staging = parseSemver(manifestVersion).staging;
  if (environment === 'production' ? staging !== null : staging !== sequence) {
    fail(
      'version',
      environment === 'production'
        ? 'must be X.Y.Z'
        : 'must be X.Y.Z-staging.<sequence>',
    );
  }
  const run = object(raw.run, 'run');
  if (typeof run.id !== 'number' || typeof run.url !== 'string') {
    fail('run', 'must be { id: number, url: string }');
  }
  return {
    schema: 1,
    environment: environment as Environment,
    sequence,
    commit: hex(raw.commit, 'commit', 40),
    version: manifestVersion,
    createdAt: string(raw.createdAt, 'createdAt'),
    run: { id: run.id as number, url: run.url as string },
    minAgentVersion: version(raw.minAgentVersion, 'minAgentVersion'),
    server: parseServer(raw.server, sequence),
    fdroid: parseFdroid(raw.fdroid, sequence),
  };
};
