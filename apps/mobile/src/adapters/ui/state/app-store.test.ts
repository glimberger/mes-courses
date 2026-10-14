import { seed } from '../seed';
import { eraserOf } from '../../../application/testing/in-memory-local-data-eraser';
import { InMemoryCredentialStore } from '../../../application/testing/in-memory-credential-store';
import { OfflineSyncServer } from '../../../application/testing/offline-sync-server';
import { OfflineAccountServer } from '../../../application/testing/offline-account-server';
import { OfflineAdminServer } from '../../../application/testing/offline-admin-server';
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
  const ids = new SequentialIdGenerator();
  const useCases: UseCases = createUseCases({
    syncServer: new OfflineSyncServer(),
    accountServer: new OfflineAccountServer(),
    adminServer: new OfflineAdminServer(),
    credentials: new InMemoryCredentialStore(),
    unitOfWork,
    ids,
    clock: new FakeClock(),
    localDataEraser: eraserOf(unitOfWork, ids, seed),
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
