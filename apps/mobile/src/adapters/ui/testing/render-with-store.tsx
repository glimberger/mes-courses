import type { ReactElement } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStoreProvider } from '../state/app-store-provider';
import { useNavigationTheme } from '../theme/navigation-theme';
import { ThemeProvider } from '../theme/theme-provider';
import { buildStoryStore, type StoryScenario } from './story-store';

const Stack = createNativeStackNavigator();

// Jest has no window to measure: a phone-sized frame with no insets.
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** `ui` as the only screen of a navigator, so it can call `useNavigation`. */
const AsScreen = ({ ui }: { ui: ReactElement }) => {
  const theme = useNavigationTheme();
  const Screen = () => ui;
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Test" component={Screen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

/**
 * Renders `ui` under the theme and a store built from the scenario as stories build theirs
 * (`buildStoryStore`), on fresh in-memory fakes. `ui` is the only screen of a navigator, unless
 * `asScreen` is false for an element that brings its own navigation container.
 */
export const renderWithStore = async (
  ui: ReactElement,
  { asScreen = true, ...scenario }: StoryScenario & { asScreen?: boolean } = {},
) => {
  const built = await buildStoryStore(scenario);

  const result = render(
    <ThemeProvider>
      <AppStoreProvider store={built.store}>
        <SafeAreaProvider initialMetrics={metrics}>
          {asScreen ? <AsScreen ui={ui} /> : ui}
        </SafeAreaProvider>
      </AppStoreProvider>
    </ThemeProvider>,
  );
  return { ...result, ...built };
};
