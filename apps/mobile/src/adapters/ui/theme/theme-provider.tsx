import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
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
};

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
}: ThemeProviderProps) => {
  const scheme = useColorScheme();
  const [setting, setCurrent] = useState<AppearanceSetting>(
    () => appearanceStore?.read() ?? DEFAULT_APPEARANCE_SETTING,
  );
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
