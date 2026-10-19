import { parseManifest } from '../domain/manifest';
import {
  checkNewVersion,
  checkPrerequisites,
  decideStep,
  nextVersion,
  parseTarget,
  validateExplicitVersion,
  type ReleaseState,
  type BumpPullRequest,
  type ReleaseStep,
  type ReleaseTarget,
} from '../domain/release-plan';
import { compareSemver } from '../domain/semver';
import { evaluateRelease, REQUIRED_WORKFLOWS } from '../domain/release-rules';
import type { ChannelSource } from './ports/channel-source';
import type { Output } from './ports/output';
import type { Prompter } from './ports/prompter';
import type { ReleasePullRequests } from './ports/release-pull-requests';
import type { ReleaseRepository } from './ports/release-repository';
import type { ReleaseRuns } from './ports/release-runs';
import type { Sleep } from './ports/sleep';

export type ReleaseDeps = {
  repository: ReleaseRepository;
  pullRequests: ReleasePullRequests;
  runs: ReleaseRuns;
  source: ChannelSource;
  prompter: Prompter;
  output: Output;
  sleep: Sleep;
};

export type ReleaseRequest = {
  target: ReleaseTarget;
  /** Skips only the `current -> next` confirmation. */
  assumeYes: boolean;
  /** Observes and prints what would be done; every mutating call is replaced by a "would" line. */
  dryRun?: boolean;
};

export type ReleaseResult =
  | { outcome: 'released' }
  | { outcome: 'declined' }
  | { outcome: 'stopped'; message: string };

const POLL_MS = 30_000;
const WAIT_LIMIT_MS = 90 * 60_000;
const RESUME_AFTER_ERROR = 'Run the same command again to resume.';
const RESUME = 'run the same command again to resume';

/** Everything that changes the repository or GitHub goes through here, so a dry run cannot leak. */
type Steps = {
  commitBump(version: string, branch: string): Promise<void>;
  openPullRequest(branch: string, title: string): Promise<BumpPullRequest>;
  enableAutoMerge(pr: BumpPullRequest): Promise<void>;
  tag(tag: string, sha: string | null): Promise<void>;
};

const realSteps = (deps: ReleaseDeps): Steps => ({
  commitBump: (version) => deps.repository.commitBump(version),
  openPullRequest: (branch, title) => deps.pullRequests.open(branch, title),
  enableAutoMerge: (pr) => deps.pullRequests.enableAutoMerge(pr),
  async tag(tag, sha) {
    if (sha === null) throw new Error('Found no release commit to tag');
    await deps.repository.createTag(tag, sha);
    await deps.repository.pushTag(tag);
  },
});

const wouldSteps = (output: Output): Steps => ({
  async commitBump(_version, branch) {
    output.line(`would commit the bump to ${branch} and push it`);
  },
  async openPullRequest(_branch, title) {
    output.line(`would open the pull request "${title}"`);
    return {
      state: 'open',
      url: '(pull request not opened)',
      mergeCommit: null,
      checksFailed: false,
    };
  },
  async enableAutoMerge() {
    output.line('would enable auto-merge (squash) on it');
  },
  async tag(tag) {
    output.line(`would tag ${tag} on the bump commit and push the tag`);
  },
});

/** What a dry run assumes happens after each step, since it does not wait for it. */
const NEXT_STEP: Partial<Record<ReleaseStep['step'], ReleaseStep>> = {
  'open-bump': { step: 'wait-merge' },
  'wait-merge': { step: 'wait-runs' },
  'wait-runs': { step: 'tag' },
};

const stopped = (message: string): ReleaseResult => ({
  outcome: 'stopped',
  message,
});

const resolveVersion = async (
  deps: ReleaseDeps,
  target: ReleaseTarget,
  current: string,
): Promise<{ version: string } | { errors: string[] }> => {
  let resolved = target;
  if (resolved.kind === 'ask') {
    const answer = await deps.prompter.ask(
      `Bump type (major, minor, patch) or version X.Y.Z (current ${current})?`,
    );
    resolved = parseTarget(answer.trim() === '' ? undefined : answer.trim());
    if (resolved.kind === 'ask')
      return { errors: ['No bump type or version given'] };
  }
  if (resolved.kind === 'bump')
    return { version: nextVersion(current, resolved.bump) };
  // The version already on main is a resume of an interrupted run, not a new release.
  if (resolved.version === current) return { version: resolved.version };
  const errors = validateExplicitVersion(resolved.version, current);
  return errors.length > 0 ? { errors } : { version: resolved.version };
};

const productionVersion = async (
  source: ChannelSource,
): Promise<string | null> => {
  const channel = await source.fetchChannel('production');
  return channel === null ? null : parseManifest(channel.manifest).version;
};

const observe = async (
  deps: ReleaseDeps,
  version: string,
  branch: string,
): Promise<ReleaseState> => {
  const { repository, pullRequests, runs } = deps;
  await repository.fetch();
  const mainVersion = await repository.appVersionAt('origin/main');
  const tags = await repository.tagCommit(`v${version}`);
  const bumpPr = await pullRequests.findBump(branch);
  const landed = compareSemver(mainVersion, version) >= 0;
  const releaseCommit = landed ? await repository.releaseCommit(version) : null;
  return {
    mainVersion,
    localTag: tags.local,
    remoteTag: tags.remote,
    bumpPr,
    releaseCommit,
    runs: releaseCommit === null ? [] : await runs.requiredRuns(releaseCommit),
    productionVersion: await productionVersion(deps.source),
  };
};

const stopMessage = (step: ReleaseStep): string | null => {
  switch (step.step) {
    case 'stop-run-failed':
      return `A required run failed${step.url === null ? '' : `: ${step.url}`}. Fix it, then ${RESUME}`;
    case 'stop-pr-failed':
      return `The bump pull request has a failed check: ${step.url}. Fix it, then ${RESUME}`;
    case 'stop-pr-closed':
      return `The bump pull request was closed without merging: ${step.url}. Reopen it or close it for good, then ${RESUME}`;
    case 'stop-tag-elsewhere':
      return `The tag ${step.tag} already points to ${step.commit}, which is not the release commit. Choose another version`;
    default:
      return null;
  }
};

/**
 * Drives a release from the observed state: every pass looks at the world and does the one next
 * step `decideStep` names, so an interrupted run resumes by running the same command again.
 */
export const runRelease = async (
  deps: ReleaseDeps,
  request: ReleaseRequest,
): Promise<ReleaseResult> => {
  try {
    return await execute(deps, request);
  } catch (error) {
    // A missing tool, an unauthenticated `gh` or a network error: stop with the reason, no crash.
    return stopped(
      `${error instanceof Error ? error.message : String(error)}\n${RESUME_AFTER_ERROR}`,
    );
  }
};

const execute = async (
  deps: ReleaseDeps,
  request: ReleaseRequest,
): Promise<ReleaseResult> => {
  const { repository, runs, prompter, output, sleep } = deps;
  const dryRun = request.dryRun === true;
  const steps = dryRun ? wouldSteps(output) : realSteps(deps);

  await repository.fetch();
  const current = await repository.appVersionAt('origin/main');
  // The version already on main is a resume of an interrupted run, not a new release.
  const resuming =
    request.target.kind === 'version' && request.target.version === current;
  const problems = checkPrerequisites({
    branch: await repository.currentBranch(),
    clean: await repository.isClean(),
    upToDate: resuming || (await repository.isUpToDate()),
  });
  if (problems.length > 0) return stopped(problems.join('\n'));

  const resolved = await resolveVersion(deps, request.target, current);
  if ('errors' in resolved) return stopped(resolved.errors.join('\n'));
  const { version } = resolved;
  const tag = `v${version}`;
  const branch = `chore/release-${version}`;

  if (version !== current) {
    const tags = await repository.tagCommit(tag);
    const refused = checkNewVersion({
      version,
      mainVersion: current,
      productionVersion: await productionVersion(deps.source),
      tagExists: tags.local !== null || tags.remote !== null,
    });
    if (refused.length > 0) return stopped(refused.join('\n'));
  }

  output.line(`${current} -> ${version}`);
  if (
    !dryRun &&
    !request.assumeYes &&
    !(await prompter.confirm(`Release ${version}?`))
  )
    return { outcome: 'declined' };

  let waitingFor: ReleaseStep['step'] | null = null;
  let waitedMs = 0;
  let assumed: ReleaseStep | null = null;
  for (;;) {
    const state = await observe(deps, version, branch);
    const step: ReleaseStep = assumed ?? decideStep(version, state);
    if (dryRun) assumed = NEXT_STEP[step.step] ?? null;

    const message = stopMessage(step);
    if (message !== null) return stopped(message);

    if (step.step === 'done') {
      output.line(`${tag} is already released`);
      return { outcome: 'released' };
    }

    if (step.step === 'open-bump') {
      await repository.fetch();
      if ((await repository.appVersionAt('origin/main')) !== current)
        return stopped(
          `origin/main changed while preparing the release (was ${current}). Check it, then ${RESUME}`,
        );
      await steps.commitBump(version, branch);
      const pr = await steps.openPullRequest(
        branch,
        `chore(release): bump the app version to ${version}`,
      );
      await steps.enableAutoMerge(pr);
      if (!dryRun) output.line(`bump pull request: ${pr.url}`);
      waitingFor = null;
      continue;
    }

    if (step.step === 'tag') {
      const sha = state.releaseCommit;
      if (dryRun) {
        await steps.tag(tag, sha);
        return { outcome: 'released' };
      }
      if (sha === null) return stopped('Found no release commit to tag');
      const failures = evaluateRelease({
        tag,
        appVersion: await repository.appVersionAt(sha),
        onMain: true,
        successfulWorkflows: state.runs
          .filter((run) => run.state === 'success')
          .map((run) => run.workflow),
        productionVersion: state.productionVersion,
      });
      if (failures.length > 0) return stopped(failures.join('\n'));
      await steps.tag(tag, sha);
      output.line(`tagged ${tag} on ${sha}`);
      output.line(`Release run: ${await runs.releaseRunUrl(sha)}`);
      return { outcome: 'released' };
    }

    // wait-merge or wait-runs
    if (dryRun) {
      output.line(
        step.step === 'wait-merge'
          ? 'would wait for the pull request to merge'
          : `would wait for ${REQUIRED_WORKFLOWS.join(', ')} on the bump commit`,
      );
      continue;
    }
    if (waitingFor !== step.step) {
      waitingFor = step.step;
      waitedMs = 0;
      output.line(
        step.step === 'wait-merge'
          ? 'waiting for the bump pull request to merge'
          : `waiting for ${REQUIRED_WORKFLOWS.join(', ')}${state.releaseCommit === null ? '' : ` on ${state.releaseCommit}`}`,
      );
    }
    if (waitedMs >= WAIT_LIMIT_MS)
      return stopped(`Gave up waiting after 90 minutes: ${RESUME}`);
    await sleep(POLL_MS);
    waitedMs += POLL_MS;
  }
};
