import { emptyInstanceState, markFailed } from '../domain/instance-state';
import { forgetFailure } from './forget-failure';
import { InMemoryStateStore } from './testing/in-memory-doubles';

describe('forgetFailure', () => {
  it('removes only the named commit and says so', async () => {
    const stateStore = new InMemoryStateStore();
    stateStore.states.set(
      'staging',
      markFailed(markFailed(emptyInstanceState(), 'a'), 'b'),
    );

    await expect(forgetFailure({ stateStore }, 'staging', 'a')).resolves.toBe(
      true,
    );

    expect(stateStore.states.get('staging')?.failedCommits).toEqual(['b']);
  });

  it('answers false and saves nothing for a commit it does not remember', async () => {
    const stateStore = new InMemoryStateStore();
    stateStore.states.set('staging', markFailed(emptyInstanceState(), 'a'));

    await expect(forgetFailure({ stateStore }, 'staging', 'z')).resolves.toBe(
      false,
    );

    expect(stateStore.states.get('staging')?.failedCommits).toEqual(['a']);
  });
});
