import { useEffect } from 'react';
import { Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { act, screen } from '@testing-library/react-native';

import { useAppStore } from '../state/use-app-store';
import { lightTheme } from '../theme/theme';
import { fixture } from './fixtures';
import { renderWithStore } from './render-with-store';

const Probe = ({ label }: { label?: string }) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const notice = useAppStore((state) => state.notice);
  return (
    <Text>
      {[
        ...(label === undefined ? [] : [label]),
        navigation.canGoBack() ? 'retour' : 'racine',
        colors.surface === lightTheme.colors.surface ? 'thème' : 'autre',
        notice?.type ?? 'aucune',
      ].join(' ')}
    </Text>
  );
};

describe('renderWithStore', () => {
  it('renders the element as a screen, under the theme and the store', async () => {
    const { store } = await renderWithStore(<Probe />);

    expect(await screen.findByText('racine thème aucune')).toBeOnTheScreen();
    act(() => store.setState({ notice: { type: 'writeFailed' } }));
    expect(screen.getByText('racine thème writeFailed')).toBeOnTheScreen();
  });

  it('gives each test a fresh store and fresh fakes', async () => {
    const first = await renderWithStore(<Probe />);
    const second = await renderWithStore(<Probe />);

    expect(second.store).not.toBe(first.store);
    expect(second.unitOfWork).not.toBe(first.unitOfWork);
  });

  it('stores the seed before rendering', async () => {
    const { unitOfWork } = await renderWithStore(<Probe />, { seed: fixture });

    expect(await unitOfWork.run((repos) => repos.lists.all())).toEqual(
      fixture.lists,
    );
  });

  it('builds its store from the scenario, as stories do', async () => {
    const { useCases } = await renderWithStore(<Probe />, {
      failing: ['initializeStore'],
    });

    await expect(
      useCases.initializeStore({
        categoryNames: [],
        firstListName: 'Ma liste',
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('keeps the providers and the screen mounted on rerender', async () => {
    let mounts = 0;
    const Mounted = ({ label }: { label: string }) => {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <Probe label={label} />;
    };
    const { rerender, store } = await renderWithStore(<Mounted label="un" />);
    await screen.findByText('un racine thème aucune');

    rerender(<Mounted label="deux" />);
    act(() => store.setState({ notice: { type: 'writeFailed' } }));

    expect(
      await screen.findByText('deux racine thème writeFailed'),
    ).toBeOnTheScreen();
    expect(mounts).toBe(1);
  });
});
