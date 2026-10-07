import { Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme } from './theme';
import { ThemeProvider } from './theme-provider';

let mockColorScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme,
}));

const ThemeName = () => {
  const { colors } = useTheme();
  const name =
    colors.surface === lightTheme.colors.surface
      ? 'light'
      : colors.surface === darkTheme.colors.surface
        ? 'dark'
        : 'other';
  return <Text>{name}</Text>;
};

describe('ThemeProvider', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    [null, 'light'],
  ] as const)(
    'gives Paper the %s system scheme as the %s theme',
    (scheme, expected) => {
      mockColorScheme = scheme;

      render(
        <ThemeProvider>
          <ThemeName />
        </ThemeProvider>,
      );

      expect(screen.getByText(expected)).toBeOnTheScreen();
    },
  );
});
