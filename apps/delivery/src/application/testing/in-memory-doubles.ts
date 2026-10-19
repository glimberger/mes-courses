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
import type { BumpPullRequest, RunOutcome } from '../../domain/release-plan';
import type { Output } from '../ports/output';
import type { Prompter } from '../ports/prompter';
import type { ReleasePullRequests } from '../ports/release-pull-requests';
import type { ReleaseRepository } from '../ports/release-repository';
import type { ReleaseRuns } from '../ports/release-runs';
import type { Sleep } from '../ports/sleep';
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

/** A sequence of answers: each call returns the next one, the last one repeats. */
export const scripted = <T>(steps: T[]): (() => T) => {
  let index = 0;
  return () => {
    if (steps.length === 0) throw new Error('No scripted step');
    const step = steps[Math.min(index, steps.length - 1)];
    index += 1;
    return step as T;
  };
};

export class InMemoryReleaseRepository implements ReleaseRepository {
  branch = 'main';
  clean = true;
  upToDate = true;
  /** App version per ref; defaults to `1.2.0` for any ref. */
  readonly appVersions = new Map<string, string>();
  readonly tags = new Map<
    string,
    { local: string | null; remote: string | null }
  >();
  /** Successive answers of `releaseCommit`; null until the bump lands. */
  releaseCommits: (string | null)[] = [null];
  private nextReleaseCommit = scripted(this.releaseCommits);
  constructor(private readonly recorder = new Recorder()) {}
  scriptReleaseCommits(commits: (string | null)[]) {
    this.releaseCommits = commits;
    this.nextReleaseCommit = scripted(commits);
  }
  async currentBranch() {
    this.recorder.record('ReleaseRepository.currentBranch');
    return this.branch;
  }
  async isClean() {
    this.recorder.record('ReleaseRepository.isClean');
    return this.clean;
  }
  async fetch() {
    this.recorder.record('ReleaseRepository.fetch');
  }
  async isUpToDate() {
    this.recorder.record('ReleaseRepository.isUpToDate');
    return this.upToDate;
  }
  async appVersionAt(ref: string) {
    this.recorder.record('ReleaseRepository.appVersionAt', ref);
    return this.appVersions.get(ref) ?? '1.2.0';
  }
  async tagCommit(tag: string) {
    this.recorder.record('ReleaseRepository.tagCommit', tag);
    return this.tags.get(tag) ?? { local: null, remote: null };
  }
  async commitBump(version: string) {
    this.recorder.record('ReleaseRepository.commitBump', version);
  }
  async createTag(tag: string, commit: string) {
    this.recorder.record('ReleaseRepository.createTag', tag, commit);
    this.tags.set(tag, {
      local: commit,
      remote: this.tags.get(tag)?.remote ?? null,
    });
  }
  async pushTag(tag: string) {
    this.recorder.record('ReleaseRepository.pushTag', tag);
    const current = this.tags.get(tag) ?? { local: null, remote: null };
    this.tags.set(tag, { ...current, remote: current.local });
  }
  async releaseCommit(version: string) {
    this.recorder.record('ReleaseRepository.releaseCommit', version);
    return this.nextReleaseCommit();
  }
}

export class InMemoryReleasePullRequests implements ReleasePullRequests {
  /** Successive answers of `findBump`; the last one repeats. */
  found: (BumpPullRequest | null)[] = [null];
  private nextFound = scripted(this.found);
  constructor(private readonly recorder = new Recorder()) {}
  scriptFound(steps: (BumpPullRequest | null)[]) {
    this.found = steps;
    this.nextFound = scripted(steps);
  }
  async findBump(branch: string) {
    this.recorder.record('ReleasePullRequests.findBump', branch);
    return this.nextFound();
  }
  async open(branch: string, title: string) {
    this.recorder.record('ReleasePullRequests.open', branch, title);
    return {
      state: 'open' as const,
      url: `https://github.test/pull/1`,
      mergeCommit: null,
      checksFailed: false,
      autoMergeEnabled: false,
    };
  }
  async enableAutoMerge(pr: BumpPullRequest) {
    this.recorder.record('ReleasePullRequests.enableAutoMerge', pr.url);
  }
}

export class InMemoryReleaseRuns implements ReleaseRuns {
  /** Successive answers of `requiredRuns`; the last one repeats. */
  runs: RunOutcome[][] = [[]];
  releaseUrl = 'https://github.test/actions/runs/release';
  private nextRuns = scripted(this.runs);
  constructor(private readonly recorder = new Recorder()) {}
  scriptRuns(steps: RunOutcome[][]) {
    this.runs = steps;
    this.nextRuns = scripted(steps);
  }
  async requiredRuns(commit: string) {
    this.recorder.record('ReleaseRuns.requiredRuns', commit);
    return this.nextRuns();
  }
  async releaseRunUrl(commit: string) {
    this.recorder.record('ReleaseRuns.releaseRunUrl', commit);
    return this.releaseUrl;
  }
}

export class ScriptedPrompter implements Prompter {
  readonly questions: string[] = [];
  constructor(
    private readonly answers: string[] = [],
    private readonly confirmations: boolean[] = [],
  ) {}
  async ask(question: string) {
    this.questions.push(question);
    const answer = this.answers.shift();
    if (answer === undefined)
      throw new Error(`No scripted answer: ${question}`);
    return answer;
  }
  async confirm(question: string) {
    this.questions.push(question);
    const answer = this.confirmations.shift();
    if (answer === undefined)
      throw new Error(`No scripted answer: ${question}`);
    return answer;
  }
}

export class FakeSleep {
  readonly durations: number[] = [];
  /** Bound so it can be passed as a `Sleep`. */
  readonly sleep: Sleep = async (ms) => {
    this.durations.push(ms);
  };
}

export class RecordedOutput implements Output {
  readonly lines: string[] = [];
  line(text: string) {
    this.lines.push(text);
  }
}
