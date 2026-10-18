import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import type { AppearanceStore } from '../../../application/ports/appearance-store';
import {
  DEFAULT_APPEARANCE_SETTING,
  type AppearanceSetting,
} from '../../../domain/appearance-setting';
import { AppIcon } from '../icons/AppIcon';
import { darkTheme, lightTheme } from './theme';

// Paper draws every icon name through this setting: the Material Symbols set replaces its default.
const paperSettings = { icon: AppIcon };

type AppearanceContext = {
  setting: AppearanceSetting;
  setSetting: (setting: AppearanceSetting) => void;
};

const AppearanceSettingContext = createContext<AppearanceContext>({
  setting: DEFAULT_APPEARANCE_SETTING,
  setSetting: () => undefined,
});

/** The appearance setting in use and how to change it; the provider applies and keeps it. */
export const useAppearanceSetting = () => useContext(AppearanceSettingContext);

export type ThemeProviderProps = {
  children: ReactNode;
  /** Forces an appearance whatever the setting; none is forced in the app (stories). */
  appearance?: 'light' | 'dark' | undefined;
  /** Where the setting is kept; without one it lasts as long as the provider (stories, tests). */
  appearanceStore?: AppearanceStore | undefined;
  /**
   * Hands the setting to the native scheme as well (see `applyNativeScheme`). Only the app does:
   * it is global, so stories and tests leave the device scheme alone.
   */
  syncNativeScheme?: boolean | undefined;
};

/**
 * Native UI (navigation bar, keyboard, system menus) follows the choice too, not only Paper.
 * The app calls it once before the first render so the first frame is already consistent.
 */
export const applyNativeScheme = (setting: AppearanceSetting) =>
  Appearance.setColorScheme(setting === 'system' ? 'unspecified' : setting);

/**
 * Gives React Native Paper the project's Material 3 light or dark theme, as the appearance
 * setting says: the system scheme (the default), or light or dark. The setting is read from its
 * store on the first render, so the first frame already has the right theme, and a change applies
 * at once and is stored. Screens must consume these tokens rather than defining a separate
 * palette.
 */
export const ThemeProvider = ({
  children,
  appearance,
  appearanceStore,
  syncNativeScheme,
}: ThemeProviderProps) => {
  const scheme = useColorScheme();
  const [setting, setCurrent] = useState<AppearanceSetting>(
    () => appearanceStore?.read() ?? DEFAULT_APPEARANCE_SETTING,
  );
  // A store handed over later is read again: the setting shown is always the store's.
  const [readFrom, setReadFrom] = useState(appearanceStore);
  if (readFrom !== appearanceStore) {
    setReadFrom(appearanceStore);
    setCurrent(appearanceStore?.read() ?? DEFAULT_APPEARANCE_SETTING);
  }
  useEffect(() => {
    if (syncNativeScheme) applyNativeScheme(setting);
  }, [syncNativeScheme, setting]);
  const setSetting = useCallback(
    (next: AppearanceSetting) => {
      setCurrent(next);
      appearanceStore?.write(next);
    },
    [appearanceStore],
  );
  const context = useMemo(
    () => ({ setting, setSetting }),
    [setting, setSetting],
  );

  const shown = appearance ?? (setting === 'system' ? scheme : setting);
  const theme = shown === 'dark' ? darkTheme : lightTheme;
  return (
    <AppearanceSettingContext.Provider value={context}>
      <PaperProvider theme={theme} settings={paperSettings}>
        {children}
      </PaperProvider>
    </AppearanceSettingContext.Provider>
  );
};
