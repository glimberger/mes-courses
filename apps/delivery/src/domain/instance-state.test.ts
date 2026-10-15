import {
  clearInFlight,
  emptyInstanceState,
  markFailed,
  recordSuccess,
  setInFlight,
} from './instance-state';

const commit = (n: number) => String(n).padStart(40, '0');

describe('emptyInstanceState', () => {
  it('has nothing recorded', () => {
    expect(emptyInstanceState()).toEqual({
      manifestSequence: null,
      server: null,
      previousServer: null,
      failedCommits: [],
      fdroid: null,
      lastFetchSuccessAt: null,
      inFlight: null,
    });
  });
});

describe('markFailed', () => {
  it('puts the commit first', () => {
    const state = markFailed(
      markFailed(emptyInstanceState(), commit(1)),
      commit(2),
    );
    expect(state.failedCommits).toEqual([commit(2), commit(1)]);
  });

  it('keeps the 10 newest', () => {
    let state = emptyInstanceState();
    for (let n = 1; n <= 12; n++) state = markFailed(state, commit(n));
    expect(state.failedCommits).toHaveLength(10);
    expect(state.failedCommits[0]).toBe(commit(12));
    expect(state.failedCommits[9]).toBe(commit(3));
  });

  it('does not list a commit twice', () => {
    const state = markFailed(
      markFailed(emptyInstanceState(), commit(1)),
      commit(1),
    );
    expect(state.failedCommits).toEqual([commit(1)]);
  });

  it('does not change the state it is given', () => {
    const before = emptyInstanceState();
    markFailed(before, commit(1));
    expect(before.failedCommits).toEqual([]);
  });
});

describe('recordSuccess', () => {
  it('moves server to previousServer', () => {
    const first = recordSuccess(emptyInstanceState(), {
      commit: commit(1),
      sequence: 1,
    });
    const second = recordSuccess(first, { commit: commit(2), sequence: 2 });
    expect(first.previousServer).toBeNull();
    expect(second.server).toEqual({ commit: commit(2), sequence: 2 });
    expect(second.previousServer).toEqual({ commit: commit(1), sequence: 1 });
  });
});

describe('inFlight', () => {
  it('is set, then cleared', () => {
    const set = setInFlight(emptyInstanceState(), {
      commit: commit(2),
      previousCommit: commit(1),
    });
    expect(set.inFlight).toEqual({
      commit: commit(2),
      previousCommit: commit(1),
    });
    expect(clearInFlight(set).inFlight).toBeNull();
  });
});
