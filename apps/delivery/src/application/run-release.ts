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
  /** A bump or a version delivers to staging; `promote` sends what staging runs to production. */
  target: ReleaseTarget;
  /** Skips only the confirmation (`current -> next`, or the promotion). */
  assumeYes: boolean;
  /** Observes and prints what would be done; every mutating call is replaced by a "would" line. */
  dryRun?: boolean;
};

export type ReleaseResult =
  | { outcome: 'released' }
  /** The version runs on staging and waits for `yarn release promote`. */
  | { outcome: 'staged' }
  | { outcome: 'declined' }
  | { outcome: 'stopped'; message: string };

const POLL_MS = 30_000;
const WAIT_LIMIT_MS = 90 * 60_000;
const RESUME_AFTER_ERROR = 'Run the same command again to resume.';
const RESUME = 'run the same command again to resume';
const PROMOTE = '`yarn release promote`';

/** Everything that changes the repository or GitHub goes through here, so a dry run cannot leak. */
type Steps = {
  commitBump(version: string, branch: string): Promise<void>;
  openPullRequest(branch: string, title: string): Promise<BumpPullRequest>;
  enableAutoMerge(pr: BumpPullRequest): Promise<void>;
  tag(tag: string, sha: string | null): Promise<void>;
  pushTag(tag: string): Promise<void>;
};

const realSteps = (deps: ReleaseDeps): Steps => ({
  commitBump: (version, branch) => deps.repository.commitBump(version, branch),
  openPullRequest: (branch, title) => deps.pullRequests.open(branch, title),
  enableAutoMerge: (pr) => deps.pullRequests.enableAutoMerge(pr),
  async tag(tag, sha) {
    if (sha === null) throw new Error('Found no release commit to tag');
    await deps.repository.createTag(tag, sha);
    await deps.repository.pushTag(tag);
  },
  pushTag: (tag) => deps.repository.pushTag(tag),
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
      autoMergeEnabled: false,
    };
  },
  async enableAutoMerge() {
    output.line('would enable auto-merge (squash) on it');
  },
  async tag(tag, sha) {
    output.line(`would tag ${tag} on ${sha} and push the tag`);
  },
  async pushTag(tag) {
    output.line(`would push the tag ${tag}`);
  },
});

/** What a dry run assumes happens after each step, since it does not wait for it. */
const NEXT_STEP: Partial<Record<ReleaseStep['step'], ReleaseStep>> = {
  'open-bump': { step: 'wait-merge' },
  'enable-auto-merge': { step: 'wait-merge' },
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
  unreleased: () => Promise<boolean>,
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
  if (resolved.kind === 'promote')
    return { errors: [`Run ${PROMOTE} on its own`] };
  if (resolved.kind === 'bump') {
    // A version on main that was never released is an interrupted run: finish it, do not bump again.
    if (await unreleased()) {
      deps.output.line(
        `${current} is on main but not released yet: resuming it instead of applying ${resolved.bump}`,
      );
      return { version: current };
    }
    return { version: nextVersion(current, resolved.bump) };
  }
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

/** The last commit delivered to staging, or null when the channel is empty. */
const stagingCommit = async (source: ChannelSource): Promise<string | null> => {
  const channel = await source.fetchChannel('staging');
  return channel === null ? null : parseManifest(channel.manifest).commit;
};

/**
 * Looks at the world for one version. What cannot change while the command waits (the tag, the
 * production version, the commit once found) is read once; the rest is read on every pass.
 */
const createObserver = (deps: ReleaseDeps, version: string, branch: string) => {
  const { repository, pullRequests, runs } = deps;
  let tags: { local: string | null; remote: string | null } | undefined;
  let production: { version: string | null } | undefined;
  let found: string | null = null;
  // Once this run has seen the pull request (or opened it), a closed one is a decision made while
  // it waited: it stops the run instead of being reopened.
  let seenPr = false;
  const observe = async (): Promise<ReleaseState> => {
    await repository.fetch();
    const mainVersion = await repository.appVersionAt('origin/main');
    tags ??= await repository.tagCommit(`v${version}`);
    production ??= { version: await productionVersion(deps.source) };
    let bumpPr = await pullRequests.findBump(branch);
    // Merged on GitHub but not yet fetched: look again before concluding that main lost the bump.
    let currentMain = mainVersion;
    if (bumpPr?.state === 'merged' && compareSemver(currentMain, version) < 0) {
      await repository.fetch();
      currentMain = await repository.appVersionAt('origin/main');
    }
    // A closed pull request whose branch is gone was abandoned before this run: start over.
    if (
      !seenPr &&
      bumpPr?.state === 'closed' &&
      !(await repository.remoteBranchExists(branch))
    )
      bumpPr = null;
    if (bumpPr !== null) seenPr = true;
    if (found === null && compareSemver(currentMain, version) >= 0)
      found = await repository.releaseCommit(version);
    return {
      mainVersion: currentMain,
      localTag: tags.local,
      remoteTag: tags.remote,
      bumpPr,
      releaseCommit: found,
      runs: found === null ? [] : await runs.requiredRuns(found),
      productionVersion: production.version,
    };
  };
  return Object.assign(observe, {
    /** The run opened the pull request itself: a closure from now on is not a leftover. */
    openedBump: () => {
      seenPr = true;
    },
  });
};

/** True when the version on main has no tag and is above production: a release left unfinished. */
const unreleasedOnMain = async (
  deps: ReleaseDeps,
  current: string,
): Promise<boolean> => {
  const tags = await deps.repository.tagCommit(`v${current}`);
  if (tags.local !== null || tags.remote !== null) return false;
  const production = await productionVersion(deps.source);
  return production === null || compareSemver(current, production) > 0;
};

const stopMessage = (step: ReleaseStep): string | null => {
  switch (step.step) {
    case 'stop-run-failed':
      return `A required run failed${step.url === null ? '' : `: ${step.url}`}. Fix it, then ${RESUME}`;
    case 'stop-run-cancelled': {
      const id = step.url === null ? null : /\/runs\/(\d+)/.exec(step.url)?.[1];
      return `A required run was cancelled, probably by a later push to main${step.url === null ? '' : `: ${step.url}`}. Re-run it${id == null ? '' : ` with \`gh run rerun ${id}\``}, then ${RESUME}`;
    }
    case 'stop-pr-failed':
      return `The bump pull request has a failed check: ${step.url}. Fix it, then ${RESUME}`;
    case 'stop-pr-closed':
      return `The bump pull request was closed without merging: ${step.url}. Reopen it, or delete its branch to start over, then ${RESUME}`;
    case 'stop-bump-gone':
      return `The bump pull request was merged but its commit is no longer on origin/main (reverted?): ${step.url}. Restore the bump on main, or choose another version (for example by passing it explicitly), then ${RESUME}`;
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

/**
 * The checks and the confirmation before a delivery to staging: the version to deliver, or the
 * result that ends the run.
 */
const prepareStaging = async (
  deps: ReleaseDeps,
  request: ReleaseRequest,
  current: string,
): Promise<{ version: string } | ReleaseResult> => {
  const { repository, prompter, output } = deps;
  // The version already on main is a resume of an interrupted run, not a new release.
  let unreleasedAnswer: Promise<boolean> | undefined;
  const unreleased = () =>
    (unreleasedAnswer ??= unreleasedOnMain(deps, current));
  // An interactive run does not know its target yet: it may resume, which is checked once it is known.
  const resuming =
    request.target.kind === 'version'
      ? request.target.version === current
      : await unreleased();
  const problems = checkPrerequisites({
    branch: await repository.currentBranch(),
    clean: await repository.isClean(),
    upToDate: resuming || (await repository.isUpToDate()),
  });
  if (problems.length > 0) return stopped(problems.join('\n'));

  const resolved = await resolveVersion(
    deps,
    request.target,
    current,
    unreleased,
  );
  if ('errors' in resolved) return stopped(resolved.errors.join('\n'));
  const { version } = resolved;
  if (resuming && version !== current && !(await repository.isUpToDate()))
    return stopped(
      checkPrerequisites({ branch: 'main', clean: true, upToDate: false }).join(
        '\n',
      ),
    );

  if (version !== current) {
    const tags = await repository.tagCommit(`v${version}`);
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
    request.dryRun !== true &&
    !request.assumeYes &&
    !(await prompter.confirm(`Deliver ${version} to staging?`))
  )
    return { outcome: 'declined' };
  return { version };
};

const execute = async (
  deps: ReleaseDeps,
  request: ReleaseRequest,
): Promise<ReleaseResult> => {
  const { repository, runs, prompter, output, sleep } = deps;
  const dryRun = request.dryRun === true;
  const promote = request.target.kind === 'promote';
  const steps = dryRun ? wouldSteps(output) : realSteps(deps);

  await repository.fetch();
  const current = await repository.appVersionAt('origin/main');
  // A promotion only tags a commit of origin/main: the local checkout does not matter.
  const prepared = promote
    ? { version: current }
    : await prepareStaging(deps, request, current);
  if (!('version' in prepared)) return prepared;
  const { version } = prepared;
  const tag = `v${version}`;
  const branch = `chore/release-${version}`;
  if (promote) output.line(`${version}: staging -> production`);

  let waitingFor: ReleaseStep['step'] | null = null;
  let waitedMs = 0;
  let autoMergeAsked = false;
  let assumed: ReleaseStep | null = null;
  const observe = createObserver(deps, version, branch);
  for (;;) {
    const state = await observe();
    let step: ReleaseStep = assumed ?? decideStep(version, state);
    // A promotion assumes nothing in a dry run: what staging has is already there to read.
    if (dryRun && !promote) assumed = NEXT_STEP[step.step] ?? null;

    const message = stopMessage(step);
    if (message !== null) return stopped(message);

    if (step.step === 'done') {
      output.line(`${tag} is already released`);
      return { outcome: 'released' };
    }

    const tagging = step.step === 'tag' || step.step === 'push-tag';

    // Only a version that staging received can be promoted.
    if (promote && !tagging)
      return stopped(
        `${version} is not delivered to staging yet${state.releaseCommit === null ? '' : ` (${state.releaseCommit})`}: run \`yarn release ${version}\` to wait for it, validate it on staging, then run ${PROMOTE}`,
      );

    // The staging half stops where the tag would go: production waits for the promotion.
    if (!promote && tagging) {
      if (dryRun) {
        output.line(`would stop with ${version} on staging, for ${PROMOTE}`);
        return { outcome: 'staged' };
      }
      output.line(`${version} is on staging (${state.releaseCommit})`);
      output.line(
        `Validate it there, then run ${PROMOTE} to release it to production.`,
      );
      return { outcome: 'staged' };
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
      autoMergeAsked = true;
      observe.openedBump();
      if (!dryRun) output.line(`bump pull request: ${pr.url}`);
      waitingFor = null;
      continue;
    }

    if (step.step === 'enable-auto-merge') {
      // Asked once per run: if GitHub does not report it back, wait for the merge instead of looping.
      if (!autoMergeAsked && state.bumpPr !== null) {
        autoMergeAsked = true;
        await steps.enableAutoMerge(state.bumpPr);
        continue;
      }
      step = { step: 'wait-merge' };
    }

    if (step.step === 'tag' || step.step === 'push-tag') {
      const sha = state.releaseCommit;
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
      // Production gets the release commit; staging may have moved on to later merges since.
      const staging = await stagingCommit(deps.source);
      if (staging !== null && staging !== sha)
        output.line(
          `staging now runs ${staging}, not ${sha}: production gets ${sha}`,
        );
      if (
        !dryRun &&
        !request.assumeYes &&
        !(await prompter.confirm(`Promote ${version} (${sha}) to production?`))
      )
        return { outcome: 'declined' };
      if (step.step === 'push-tag') {
        // The tag already exists locally: it still goes through the same checks and confirmation.
        await steps.pushTag(tag);
        if (dryRun) return { outcome: 'released' };
        output.line(`pushed ${tag} on ${sha}`);
        output.line(`Release run: ${await runs.releaseRunUrl(sha)}`);
        return { outcome: 'released' };
      }
      await steps.tag(tag, sha);
      if (dryRun) return { outcome: 'released' };
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
