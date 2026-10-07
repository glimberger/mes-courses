import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import type { AppStore } from '../state/app-store';
import { AppStoreProvider } from '../state/app-store-provider';
import { useNavigationTheme } from '../theme/navigation-theme';
import { ThemeProvider } from '../theme/theme-provider';
import { createStoryStore, type StoryScenario } from './story-store';

/** The story parameters the decorator reads. */
export type AppStoryParameters = {
  /** The store's starting point; an empty store when there is none. */
  scenario?: StoryScenario;
  /**
   * Renders the story with the theme only, without store or navigation, as the app shows its
   * startup and crash screens.
   */
  withoutStore?: boolean;
};

const Stack = createNativeStackNavigator();

/** The story as the only screen of a navigator, so a screen can call `useNavigation`. */
const AsScreen = ({ Story }: { Story: ComponentType }) => {
  const theme = useNavigationTheme();
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Story" component={Story} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

/** Renders its children once the scenario's store is built, nothing before. */
const WithStoryStore = ({
  scenario,
  children,
}: {
  scenario: StoryScenario;
  children: ReactNode;
}) => {
  const [built, setBuilt] = useState<
    { store: AppStore } | { error: unknown } | null
  >(null);
  useEffect(() => {
    let live = true;
    createStoryStore(scenario).then(
      (store) => live && setBuilt({ store }),
      (error: unknown) => live && setBuilt({ error }),
    );
    return () => {
      live = false;
    };
  }, [scenario]);

  if (built === null) return null;
  // A scenario that cannot be built is a broken story: the story test reports it.
  if ('error' in built) throw built.error;
  return <AppStoreProvider store={built.store}>{children}</AppStoreProvider>;
};

/**
 * The decorator of every story (research R22): the theme of the system scheme, the safe area,
 * and, unless `withoutStore`, a store from `createStoryStore(parameters.scenario ?? {})` and a
 * navigator holding the story.
 */
export const withAppProviders = (
  Story: ComponentType,
  { parameters }: { parameters: AppStoryParameters },
) => (
  <ThemeProvider>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {parameters.withoutStore ? (
        <Story />
      ) : (
        <WithStoryStore scenario={parameters.scenario ?? {}}>
          <AsScreen Story={Story} />
        </WithStoryStore>
      )}
    </SafeAreaProvider>
  </ThemeProvider>
);
