import { InMemoryCredentialStore } from '../../../application/testing/in-memory-credential-store';
import { OfflineSyncServer } from '../../../application/testing/offline-sync-server';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../../../application/testing/in-memory-repositories';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { FakeClock } from '../../../application/testing/fake-clock';
import { SequentialIdGenerator } from '../../../application/testing/sequential-id-generator';
import { createUseCases, type UseCases } from '../use-cases';
import { createAppStore } from './app-store';

const buildStore = () => {
  const unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
  const useCases: UseCases = createUseCases({
    syncServer: new OfflineSyncServer(),
    credentials: new InMemoryCredentialStore(),
    unitOfWork,
    ids: new SequentialIdGenerator(),
    clock: new FakeClock(),
  });
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
