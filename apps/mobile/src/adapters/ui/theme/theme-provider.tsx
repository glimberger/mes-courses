import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { darkTheme, lightTheme } from './theme';

/** Gives Paper the light or dark theme, following the system scheme. */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const theme = useColorScheme() === 'dark' ? darkTheme : lightTheme;
  return <PaperProvider theme={theme}>{children}</PaperProvider>;
};
