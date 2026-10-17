import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { AppIcon } from '../icons/AppIcon';
import { darkTheme, lightTheme } from './theme';

// Paper draws every icon name through this setting: the Material Symbols set replaces its default.
const paperSettings = { icon: AppIcon };

/**
 * Gives React Native Paper the project's Material 3 light or dark theme,
 * following the system scheme. Screens must consume these tokens rather than
 * defining a separate palette.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const theme = useColorScheme() === 'dark' ? darkTheme : lightTheme;
  return (
    <PaperProvider theme={theme} settings={paperSettings}>
      {children}
    </PaperProvider>
  );
};
