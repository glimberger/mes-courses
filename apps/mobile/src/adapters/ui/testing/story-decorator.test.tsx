import { Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { render, screen } from '@testing-library/react-native';

import { useAppStore } from '../state/use-app-store';
import { darkTheme, lightTheme } from '../theme/theme';
import { fixture } from './fixtures';
import { withAppProviders } from './story-decorator';

let mockColorScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme,
}));

const schemeOf = (surface: string) =>
  surface === lightTheme.colors.surface
    ? 'clair'
    : surface === darkTheme.colors.surface
      ? 'sombre'
      : 'autre';

/** A story that needs the theme, the safe area and the navigation. */
const ScreenStory = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  useSafeAreaInsets();
  return (
    <Text>
      {`${schemeOf(colors.surface)} ${navigation.canGoBack() ? 'retour' : 'racine'}`}
    </Text>
  );
};

/** A story that reads the store. */
const StoreStory = () => {
  const notice = useAppStore((state) => state.notice);
  return <Text>{`avis ${notice?.type ?? 'aucun'}`}</Text>;
};

const renderStory = (
  Story: () => React.JSX.Element,
  parameters: Parameters<typeof withAppProviders>[1]['parameters'] = {},
) => render(withAppProviders(Story, { parameters }));

describe('withAppProviders', () => {
  it.each([
    ['light', 'clair'],
    ['dark', 'sombre'],
  ] as const)(
    'renders the story as a screen in the %s theme of the system scheme',
    async (scheme, shown) => {
      mockColorScheme = scheme;

      renderStory(ScreenStory);

      expect(await screen.findByText(`${shown} racine`)).toBeOnTheScreen();
    },
  );

  it('gives the story a store built from its scenario', async () => {
    mockColorScheme = 'light';
    let seeded = 0;

    renderStory(StoreStory, {
      scenario: {
        seed: fixture,
        prepare: async () => {
          seeded += 1;
        },
      },
    });

    expect(await screen.findByText('avis aucun')).toBeOnTheScreen();
    expect(seeded).toBe(1);
  });

  it('gives a story with no scenario an empty store', async () => {
    renderStory(StoreStory);

    expect(await screen.findByText('avis aucun')).toBeOnTheScreen();
  });

  it('renders a story without a store when it asks for none, as the app before startup ends', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation();
    try {
      expect(() => renderStory(StoreStory, { withoutStore: true })).toThrow(
        'AppStoreProvider',
      );
    } finally {
      error.mockRestore();
    }
    renderStory(() => <Text>sans magasin</Text>, { withoutStore: true });

    expect(screen.getByText('sans magasin')).toBeOnTheScreen();
  });
});
