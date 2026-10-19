import { parseManifest } from '../domain/manifest';
import {
  decideStep,
  nextVersion,
  parseTarget,
  validateExplicitVersion,
  type ReleaseState,
  type ReleaseStep,
  type ReleaseTarget,
} from '../domain/release-plan';
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
};

export type ReleaseResult =
  | { outcome: 'released' }
  | { outcome: 'declined' }
  | { outcome: 'stopped'; message: string };

const POLL_MS = 30_000;
const WAIT_LIMIT_MS = 90 * 60_000;
const RESUME = 'run the same command again to resume';

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
  const landed = mainVersion === version;
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
  const { repository, pullRequests, runs, prompter, output, sleep } = deps;

  await repository.fetch();
  const current = await repository.appVersionAt('origin/main');
  const resolved = await resolveVersion(deps, request.target, current);
  if ('errors' in resolved) return stopped(resolved.errors.join('\n'));
  const { version } = resolved;
  const tag = `v${version}`;
  const branch = `chore/release-${version}`;

  output.line(`${current} -> ${version}`);
  if (!request.assumeYes && !(await prompter.confirm(`Release ${version}?`)))
    return { outcome: 'declined' };

  let waitingFor: ReleaseStep['step'] | null = null;
  let waitedMs = 0;
  for (;;) {
    const state = await observe(deps, version, branch);
    const step = decideStep(version, state);

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
      await repository.commitBump(version);
      const pr = await pullRequests.open(
        branch,
        `chore(release): bump the app version to ${version}`,
      );
      await pullRequests.enableAutoMerge(pr);
      output.line(`bump pull request: ${pr.url}`);
      waitingFor = null;
      continue;
    }

    if (step.step === 'tag') {
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
      await repository.createTag(tag, sha);
      await repository.pushTag(tag);
      output.line(`tagged ${tag} on ${sha}`);
      output.line(`Release run: ${await runs.releaseRunUrl(sha)}`);
      return { outcome: 'released' };
    }

    // wait-merge or wait-runs
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
