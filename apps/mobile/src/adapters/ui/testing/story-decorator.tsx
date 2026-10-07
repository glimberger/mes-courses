import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import type { AppStore } from '../state/app-store';
import { AppStoreProvider } from '../state/app-store-provider';
import { ThemeProvider } from '../theme/theme-provider';
import { AsScreen } from './as-screen';
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

// One object, so a story without a scenario keeps its store when the decorator renders again.
const EMPTY_SCENARIO: StoryScenario = {};

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
        <WithStoryStore scenario={parameters.scenario ?? EMPTY_SCENARIO}>
          <AsScreen>
            <Story />
          </AsScreen>
        </WithStoryStore>
      )}
    </SafeAreaProvider>
  </ThemeProvider>
);
