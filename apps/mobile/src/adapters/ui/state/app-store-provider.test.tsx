import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../../../application/testing/in-memory-repositories';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { SequentialIdGenerator } from '../../../application/testing/sequential-id-generator';
import { createInitializeStore } from '../../../application/use-cases/initialize-store';
import { createAppStore } from './app-store';
import { AppStoreProvider } from './app-store-provider';
import { useAppStore } from './use-app-store';

const buildStore = () =>
  createAppStore({
    useCases: {
      initializeStore: createInitializeStore({
        unitOfWork: new InMemoryUnitOfWork(new InMemoryRepositories()),
        ids: new SequentialIdGenerator(),
      }),
    },
    errorReporter: new RecordingErrorReporter(),
  });

describe('useAppStore', () => {
  it('renders the slice it selects, and renders again when that slice changes', () => {
    const store = buildStore();
    const NoticeType = () => {
      const notice = useAppStore((state) => state.notice);
      return <Text>{notice?.type ?? 'aucune'}</Text>;
    };
    render(
      <AppStoreProvider store={store}>
        <NoticeType />
      </AppStoreProvider>,
    );
    expect(screen.getByText('aucune')).toBeOnTheScreen();

    act(() => store.setState({ notice: { type: 'writeFailed' } }));

    expect(screen.getByText('writeFailed')).toBeOnTheScreen();
  });

  it('does not render again when another slice changes', () => {
    const store = buildStore();
    const renders = jest.fn();
    const ListsStatus = () => {
      const status = useAppStore((state) => state.lists.status);
      renders();
      return <Text>{status}</Text>;
    };
    render(
      <AppStoreProvider store={store}>
        <ListsStatus />
      </AppStoreProvider>,
    );

    act(() => store.setState({ notice: { type: 'writeFailed' } }));

    expect(renders).toHaveBeenCalledTimes(1);
  });

  it('fails with a clear message outside an AppStoreProvider', () => {
    const Orphan = () => {
      useAppStore((state) => state.notice);
      return null;
    };
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => render(<Orphan />)).toThrow(
      'App store hooks must be used inside an AppStoreProvider',
    );
    consoleError.mockRestore();
  });
});
