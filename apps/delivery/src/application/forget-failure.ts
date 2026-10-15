import type { Environment } from '../domain/manifest';
import type { StateStore } from './ports/state-store';

/**
 * Removes a commit from `failedCommits`, so the next pass can try it again. Returns false when
 * the commit is not remembered as failed.
 */
export const forgetFailure = async (
  deps: { stateStore: StateStore },
  environment: Environment,
  commit: string,
): Promise<boolean> => {
  const state = await deps.stateStore.load(environment);
  if (!state.failedCommits.includes(commit)) return false;
  await deps.stateStore.save(environment, {
    ...state,
    failedCommits: state.failedCommits.filter((c) => c !== commit),
  });
  return true;
};
