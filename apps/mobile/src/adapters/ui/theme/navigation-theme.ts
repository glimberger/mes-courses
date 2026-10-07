import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  type Theme,
} from '@react-navigation/native';
import { adaptNavigationTheme, useTheme } from 'react-native-paper';

import { darkTheme, lightTheme } from './theme';

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationLightTheme,
  reactNavigationDark: NavigationDarkTheme,
  materialLight: lightTheme,
  materialDark: darkTheme,
});

/** The navigation theme matching the Paper theme in use, so screens get its background. */
export const useNavigationTheme = (): Theme =>
  useTheme().dark ? DarkTheme : LightTheme;
