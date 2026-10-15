import {
  emptyInstanceState,
  type InstanceState,
} from '../../domain/instance-state';
import type { Environment } from '../../domain/manifest';
import type { ChannelFiles, ChannelSource } from '../ports/channel-source';
import type { ChannelPublisher } from '../ports/channel-publisher';
import type { DiskSpace } from '../ports/disk-space';
import type { Clock } from '../ports/clock';
import type { CommandResult, CommandRunner } from '../ports/command-runner';
import type { DatabaseSnapshots } from '../ports/database-snapshots';
import type { FdroidSite } from '../ports/fdroid-site';
import type { GitFacts } from '../ports/git-facts';
import type { HealthProbe, HealthResult } from '../ports/health-probe';
import type { PortOverride } from '../ports/port-override';
import type { ReleaseStore } from '../ports/release-store';
import type { CheckInStatus, ReportLevel, Reporter } from '../ports/reporter';
import type { RunHistory } from '../ports/run-history';
import type { ServiceManager } from '../ports/service-manager';
import type { SignatureVerifier } from '../ports/signature-verifier';
import type { Signer } from '../ports/signer';
import { StateCorruptError, type StateStore } from '../ports/state-store';
import { Recorder } from './recorder';

/** Each double records `Port.method args` in the shared recorder and can be scripted to fail. */

export class InMemoryChannelSource implements ChannelSource {
  readonly channels = new Map<Environment, ChannelFiles>();
  constructor(private readonly recorder = new Recorder()) {}
  async fetchChannel(environment: Environment) {
    this.recorder.record('ChannelSource.fetchChannel', environment);
    return this.channels.get(environment) ?? null;
  }
  async downloadAsset(
    environment: Environment,
    asset: string,
    destination: string,
  ) {
    this.recorder.record(
      'ChannelSource.downloadAsset',
      environment,
      asset,
      destination,
    );
  }
}

export class InMemoryChannelPublisher implements ChannelPublisher {
  constructor(private readonly recorder = new Recorder()) {}
  async uploadAsset(environment: Environment, file: string) {
    this.recorder.record('ChannelPublisher.uploadAsset', environment, file);
  }
  async uploadSignature(environment: Environment, signature: string) {
    this.recorder.record(
      'ChannelPublisher.uploadSignature',
      environment,
      signature,
    );
  }
  async uploadManifest(environment: Environment, manifest: string) {
    this.recorder.record(
      'ChannelPublisher.uploadManifest',
      environment,
      manifest,
    );
  }
  async prune(environment: Environment, referenced: string[]) {
    this.recorder.record(
      'ChannelPublisher.prune',
      environment,
      referenced.join(','),
    );
  }
}

/** Signs as `signed:<content>`, so a verifier can tell a matching pair from another. */
export class FakeSigner implements Signer, SignatureVerifier {
  constructor(private readonly recorder = new Recorder()) {}
  async sign(content: string) {
    this.recorder.record('Signer.sign');
    return `signed:${content}`;
  }
  async verify(content: string, signature: string) {
    this.recorder.record('SignatureVerifier.verify');
    return signature === `signed:${content}`;
  }
}

export class InMemoryReleaseStore implements ReleaseStore {
  /** What `current` points to, per environment. */
  readonly current = new Map<
    Environment,
    { commit: string; sequence: number | null }
  >();
  constructor(private readonly recorder = new Recorder()) {}
  async install(
    environment: Environment,
    commit: string,
    archive: string,
    sha256: string,
  ) {
    this.recorder.record(
      'ReleaseStore.install',
      environment,
      commit,
      archive,
      sha256,
    );
    return this.path(environment, commit);
  }
  path(environment: Environment, commit: string) {
    return `/releases/${environment}/${commit}`;
  }
  async activate(environment: Environment, commit: string) {
    this.recorder.record('ReleaseStore.activate', environment, commit);
  }
  async currentRelease(environment: Environment) {
    this.recorder.record('ReleaseStore.currentRelease', environment);
    return this.current.get(environment) ?? null;
  }
  async prune(environment: Environment) {
    this.recorder.record('ReleaseStore.prune', environment);
  }
  async buildRuntime(
    environment: Environment,
    commit: string,
    nixpkgsRev: string,
  ) {
    this.recorder.record(
      'ReleaseStore.buildRuntime',
      environment,
      commit,
      nixpkgsRev,
    );
  }
}

export class InMemoryServiceManager implements ServiceManager {
  active = true;
  constructor(private readonly recorder = new Recorder()) {}
  async start(environment: Environment) {
    this.recorder.record('ServiceManager.start', environment);
    this.active = true;
  }
  async stop(environment: Environment) {
    this.recorder.record('ServiceManager.stop', environment);
    this.active = false;
  }
  async restart(environment: Environment) {
    this.recorder.record('ServiceManager.restart', environment);
    this.active = true;
  }
  async isActive(environment: Environment) {
    this.recorder.record('ServiceManager.isActive', environment);
    return this.active;
  }
}

export class InMemoryPortOverride implements PortOverride {
  constructor(private readonly recorder = new Recorder()) {}
  async useValidationPort(environment: Environment) {
    this.recorder.record('PortOverride.useValidationPort', environment);
  }
  async usePublicPort(environment: Environment) {
    this.recorder.record('PortOverride.usePublicPort', environment);
  }
}

/** Answers from a script: the next results in order, then `fallback`. */
export class ScriptedHealthProbe implements HealthProbe {
  readonly results: HealthResult[] = [];
  fallback: HealthResult = 'healthy';
  constructor(private readonly recorder = new Recorder()) {}
  async waitForCommit(port: number, commit: string, timeoutMs: number) {
    this.recorder.record('HealthProbe.waitForCommit', port, commit, timeoutMs);
    return this.results.shift() ?? this.fallback;
  }
}

export class InMemoryDatabaseSnapshots implements DatabaseSnapshots {
  constructor(private readonly recorder = new Recorder()) {}
  /** A fresh instance has no database to copy. */
  hasDatabase = true;
  async take(environment: Environment, previousCommit: string | null) {
    this.recorder.record('DatabaseSnapshots.take', environment, previousCommit);
    return this.hasDatabase ? `copy-${previousCommit ?? 'none'}` : null;
  }
  async restore(environment: Environment, copy: string) {
    this.recorder.record('DatabaseSnapshots.restore', environment, copy);
  }
}

export class InMemoryDiskSpace implements DiskSpace {
  free = 100 * 1024 ** 3;
  database = 0;
  constructor(private readonly recorder = new Recorder()) {}
  async freeBytes() {
    this.recorder.record('DiskSpace.freeBytes');
    return this.free;
  }
  async databaseBytes(environment: Environment) {
    this.recorder.record('DiskSpace.databaseBytes', environment);
    return this.database;
  }
}

export class InMemoryFdroidSite implements FdroidSite {
  constructor(private readonly recorder = new Recorder()) {}
  async publish(
    environment: Environment,
    commit: string,
    archive: string,
    sha256: string,
  ) {
    this.recorder.record(
      'FdroidSite.publish',
      environment,
      commit,
      archive,
      sha256,
    );
  }
}

export class InMemoryStateStore implements StateStore {
  readonly states = new Map<Environment, InstanceState>();
  /** Environments whose file cannot be read until it is set aside. */
  readonly corrupt = new Set<Environment>();
  constructor(private readonly recorder = new Recorder()) {}
  async load(environment: Environment) {
    this.recorder.record('StateStore.load', environment);
    if (this.corrupt.has(environment)) throw new StateCorruptError('bad json');
    return this.states.get(environment) ?? emptyInstanceState();
  }
  async setAside(environment: Environment) {
    this.recorder.record('StateStore.setAside', environment);
    this.corrupt.delete(environment);
  }
  async save(environment: Environment, state: InstanceState) {
    this.recorder.record('StateStore.save', environment);
    this.states.set(environment, state);
  }
}

export type RecordedReport = {
  level: ReportLevel;
  message: string;
  context: Record<string, string>;
};

export class InMemoryReporter implements Reporter {
  readonly reports: RecordedReport[] = [];
  readonly checkIns: CheckInStatus[] = [];
  checkIn(status: CheckInStatus) {
    this.checkIns.push(status);
  }
  report(
    level: ReportLevel,
    message: string,
    context: Record<string, string> = {},
  ) {
    this.reports.push({ level, message, context });
  }
}

export class FakeClock implements Clock {
  constructor(public ms = Date.parse('2026-10-20T08:00:00.000Z')) {}
  nowMs() {
    return this.ms;
  }
}

export class InMemoryRunHistory implements RunHistory {
  readonly successes = new Map<string, string[]>();
  async successfulWorkflows(commit: string) {
    return this.successes.get(commit) ?? [];
  }
}

export class InMemoryGitFacts implements GitFacts {
  readonly onMain = new Set<string>();
  readonly appVersions = new Map<string, string>();
  async isOnMain(commit: string) {
    return this.onMain.has(commit);
  }
  async appVersionAt(commit: string) {
    const version = this.appVersions.get(commit);
    if (version === undefined) throw new Error(`No app version at ${commit}`);
    return version;
  }
}

export class ScriptedCommandRunner implements CommandRunner {
  readonly results: Partial<CommandResult>[] = [];
  constructor(private readonly recorder = new Recorder()) {}
  async run(command: string, args: string[]): Promise<CommandResult> {
    this.recorder.record('CommandRunner.run', command, ...args);
    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
      ...this.results.shift(),
    };
  }
}
