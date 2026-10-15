export type ReleaseRef = { commit: string; sequence: number };

export type InstanceState = {
  /** The last manifest fully handled. */
  manifestSequence: number | null;
  /** The server release `current` points to. */
  server: ReleaseRef | null;
  /** The release before it, the rollback target. */
  previousServer: ReleaseRef | null;
  /** Server commits that failed here and are never retried, newest first. */
  failedCommits: string[];
  /** The repository being served. */
  fdroid: { commit: string; versionCode: number } | null;
  lastFetchSuccessAt: string | null;
  /** Set before the service is stopped, cleared at the outcome. */
  inFlight: { commit: string; previousCommit: string | null } | null;
};

const MAX_FAILED_COMMITS = 10;

export const emptyInstanceState = (): InstanceState => ({
  manifestSequence: null,
  server: null,
  previousServer: null,
  failedCommits: [],
  fdroid: null,
  lastFetchSuccessAt: null,
  inFlight: null,
});

export const markFailed = (
  state: InstanceState,
  commit: string,
): InstanceState => ({
  ...state,
  failedCommits: [
    commit,
    ...state.failedCommits.filter((c) => c !== commit),
  ].slice(0, MAX_FAILED_COMMITS),
});

export const recordSuccess = (
  state: InstanceState,
  server: ReleaseRef,
): InstanceState => ({
  ...state,
  previousServer: state.server,
  server,
});

export const setInFlight = (
  state: InstanceState,
  inFlight: NonNullable<InstanceState['inFlight']>,
): InstanceState => ({ ...state, inFlight });

export const clearInFlight = (state: InstanceState): InstanceState => ({
  ...state,
  inFlight: null,
});
