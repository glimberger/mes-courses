import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../../../application/testing/in-memory-repositories';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { SequentialIdGenerator } from '../../../application/testing/sequential-id-generator';
import { createInitializeStore } from '../../../application/use-cases/initialize-store';
import type { UseCases } from '../use-cases';
import { createAppStore } from './app-store';

const buildStore = () => {
  const unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
  const useCases: UseCases = {
    initializeStore: createInitializeStore({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    }),
  };
  return createAppStore({
    useCases,
    errorReporter: new RecordingErrorReporter(),
  });
};

describe('createAppStore', () => {
  it('starts with every region idle, never requested', () => {
    const state = buildStore().getState();

    expect(state.currentList).toEqual({ status: 'idle' });
    expect(state.catalog).toEqual({
      query: '',
      full: { status: 'idle' },
      view: { status: 'idle' },
    });
    expect(state.lists).toEqual({ status: 'idle' });
  });

  it('starts with no notice, and dismissNotice() clears one', () => {
    const store = buildStore();
    expect(store.getState().notice).toBeNull();

    store.setState({ notice: { type: 'writeFailed' } });
    store.getState().dismissNotice();

    expect(store.getState().notice).toBeNull();
  });

  it('starts with no undo offer', () => {
    expect(buildStore().getState().pendingUndo).toBeNull();
  });
});
