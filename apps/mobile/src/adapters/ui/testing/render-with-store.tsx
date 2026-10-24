import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStoreProvider } from '../state/app-store-provider';
import { ThemeProvider } from '../theme/theme-provider';
import { AsScreen } from './as-screen';
import { buildStoryStore, type StoryScenario } from './story-store';

// Jest has no window to measure: a phone-sized frame with no insets, unless a test asks for one.
const metricsWith = (bottomInset: number) => ({
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: bottomInset },
});

/**
 * Renders `ui` under the theme and a store built from the scenario as stories build theirs
 * (`buildStoryStore`), on fresh in-memory fakes. `ui` is the only screen of a navigator, unless
 * `asScreen` is false for an element that brings its own navigation container. The providers
 * are RTL's `wrapper`, so `rerender` keeps them.
 */
export const renderWithStore = async (
  ui: ReactElement,
  {
    asScreen = true,
    routeParams,
    bottomInset = 0,
    ...scenario
  }: StoryScenario & {
    asScreen?: boolean;
    routeParams?: object;
    /** A bottom safe-area inset, for the tests of what must not add it twice. */
    bottomInset?: number;
  } = {},
) => {
  const built = await buildStoryStore(scenario);

  const Providers = ({ children }: { children: ReactNode }) => (
    <ThemeProvider>
      <AppStoreProvider store={built.store}>
        <SafeAreaProvider initialMetrics={metricsWith(bottomInset)}>
          {asScreen ? (
            <AsScreen params={routeParams}>{children}</AsScreen>
          ) : (
            children
          )}
        </SafeAreaProvider>
      </AppStoreProvider>
    </ThemeProvider>
  );
  const result = render(ui, { wrapper: Providers });
  return { ...result, ...built };
};
