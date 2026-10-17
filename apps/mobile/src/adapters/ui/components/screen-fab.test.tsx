import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { shadows } from '../theme/elevation';
import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { ABOVE_SCREEN_FAB, ScreenFab } from './ScreenFab';

const BOTTOM_INSET = 34;

const renderFab = (theme: AppTheme, onPress = jest.fn()) => {
  render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, bottom: BOTTOM_INSET, left: 0, right: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <PaperProvider theme={theme}>
        <ScreenFab testID="fab" icon="add" label="Ajouter" onPress={onPress} />
      </PaperProvider>
    </SafeAreaProvider>,
  );
  return { fab: screen.getByTestId('fab'), onPress };
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('ScreenFab in the %s appearance', (_name, theme) => {
  it('is a 56 dp fab with 18 dp corners on primaryContainer, with the fab shadow', () => {
    const { fab } = renderFab(theme);
    expect(fab).toHaveStyle({
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.primaryContainer,
      boxShadow: shadows(theme).fab,
    });
  });

  it('keeps no tonal elevation', () => {
    const { fab } = renderFab(theme);
    expect(StyleSheet.flatten(fab.props.style).elevation).toBeUndefined();
  });

  it('sits 16 dp from the end and 24 dp from the bottom plus the bottom inset', () => {
    const { fab } = renderFab(theme);
    expect(fab).toHaveStyle({
      end: 16,
      bottom: 24 + BOTTOM_INSET,
    });
  });

  it('pads 22 dp on the sides with a 9 dp gap between icon and label', () => {
    renderFab(theme);
    const content = screen.getByRole('button', { name: 'Ajouter' });
    expect(content).toBeOnTheScreen();
    expect(screen.getByText('Ajouter')).toHaveStyle({
      color: theme.colors.onPrimaryContainer,
      fontFamily: theme.fonts.labelLarge.fontFamily,
    });
    expect(screen.UNSAFE_getByProps({ source: 'add' }).props.size).toBe(24);
  });

  it('calls onPress when pressed', () => {
    const { onPress } = renderFab(theme);
    fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

it('exports the space snackbars keep above the fab: 24 + 56 + 12 = 92 dp', () => {
  expect(ABOVE_SCREEN_FAB.bottom).toBe(92);
});
