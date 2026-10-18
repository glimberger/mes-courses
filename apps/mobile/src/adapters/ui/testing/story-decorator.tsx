import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import type { AppearanceStore } from '../../../application/ports/appearance-store';
import type { AppearanceSetting } from '../../../domain/appearance-setting';
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
  /** The route params of a screen story. */
  routeParams?: object;
  /** The appearance the story is drawn in; the system scheme when none is given. */
  appearance?: 'light' | 'dark';
  /** The appearance setting the story starts with; `system` when none is given. */
  appearanceSetting?: AppearanceSetting;
};

// One object, so a story without a scenario keeps its store when the decorator renders again.
const EMPTY_SCENARIO: StoryScenario = {};

const storyAppearanceStores = new Map<AppearanceSetting, AppearanceStore>();

/**
 * A store that holds the setting a story starts with and keeps nothing. One per setting, so its
 * identity is stable across renders.
 */
const storyAppearanceStore = (setting: AppearanceSetting) => {
  let store = storyAppearanceStores.get(setting);
  if (store === undefined) {
    store = { read: () => setting, write: () => undefined };
    storyAppearanceStores.set(setting, store);
  }
  return store;
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
  <ThemeProvider
    appearance={parameters.appearance}
    appearanceStore={
      parameters.appearanceSetting === undefined
        ? undefined
        : storyAppearanceStore(parameters.appearanceSetting)
    }
  >
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {parameters.withoutStore ? (
        <Story />
      ) : (
        <WithStoryStore scenario={parameters.scenario ?? EMPTY_SCENARIO}>
          <AsScreen params={parameters.routeParams}>
            <Story />
          </AsScreen>
        </WithStoryStore>
      )}
    </SafeAreaProvider>
  </ThemeProvider>
);
