import { Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { AppbarIconAction } from './AppbarIconAction';
import { BackAction } from './BackAction';
import { ScreenHeader, type ScreenHeaderProps } from './ScreenHeader';

const STATUS_BAR = 47;

const renderHeader = (
  theme: AppTheme,
  props: Partial<ScreenHeaderProps> & { title: string },
) => {
  render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: STATUS_BAR, bottom: 0, left: 0, right: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <PaperProvider theme={theme}>
        <ScreenHeader testID="header" {...props} />
      </PaperProvider>
    </SafeAreaProvider>,
  );
  return screen.getByTestId('header', { includeHiddenElements: true });
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('ScreenHeader in the %s appearance', (_name, theme) => {
  describe('large', () => {
    it('starts inside the status bar inset, 14 dp down, with 10 dp below', () => {
      const header = renderHeader(theme, { title: 'Liste de courses' });
      expect(header).toHaveStyle({
        paddingTop: STATUS_BAR + 14,
        paddingBottom: 10,
        paddingStart: 20,
        paddingEnd: 8,
      });
    });

    it('sets the title as a header in headlineMedium, onSurface, without truncation', () => {
      renderHeader(theme, { title: 'Liste de courses' });
      const title = screen.getByRole('header', { name: 'Liste de courses' });
      expect(title).toHaveStyle({
        color: theme.colors.onSurface,
        fontFamily: theme.fonts.headlineMedium.fontFamily,
      });
      expect(title.props.numberOfLines).toBeUndefined();
    });

    it('uses titleLarge for a title in a smaller bar', () => {
      renderHeader(theme, {
        title: 'Ajouter des articles',
        titleVariant: 'titleLarge',
      });
      expect(
        screen.getByRole('header', { name: 'Ajouter des articles' }),
      ).toHaveStyle({ fontFamily: theme.fonts.titleLarge.fontFamily });
    });

    it('shows the chip 6 dp below the title and the actions at the end', () => {
      renderHeader(theme, {
        title: 'Liste',
        chip: <Text>3 restants</Text>,
        actions: <Text>Actions</Text>,
      });
      expect(screen.getByText('3 restants')).toBeOnTheScreen();
      expect(screen.getByText('Actions')).toBeOnTheScreen();
    });
  });

  describe('center', () => {
    it('centers the title in titleLarge', () => {
      renderHeader(theme, { title: 'Mes listes', variant: 'center' });
      const title = screen.getByRole('header', { name: 'Mes listes' });
      expect(title).toHaveStyle({
        textAlign: 'center',
        fontFamily: theme.fonts.titleLarge.fontFamily,
      });
    });

    it('puts a back action at the start, with a 48 dp target', () => {
      const onBack = jest.fn();
      renderHeader(theme, { title: 'Réglages', variant: 'center', onBack });
      const back = screen.getByRole('button', { name: 'Retour' });
      expect(back).toHaveStyle({ width: 48, height: 48 });
      fireEvent.press(back);
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });
});

describe('the header actions', () => {
  it('draws the Appbar icon action as a 48 dp circle with a 24 dp icon', () => {
    render(
      <PaperProvider theme={lightTheme}>
        <AppbarIconAction
          icon="add"
          accessibilityLabel="Ajouter"
          onPress={jest.fn()}
        />
      </PaperProvider>,
    );
    expect(screen.getByRole('button', { name: 'Ajouter' })).toHaveStyle({
      width: 48,
      height: 48,
      borderRadius: 24,
    });
    expect(screen.UNSAFE_getByProps({ source: 'add' }).props.size).toBe(24);
  });

  it('draws the back action with the arrow_back symbol, labelled Retour', () => {
    render(
      <PaperProvider theme={lightTheme}>
        <BackAction onPress={jest.fn()} />
      </PaperProvider>,
    );
    expect(screen.getByRole('button', { name: 'Retour' })).toBeOnTheScreen();
    expect(screen.UNSAFE_getByProps({ source: 'arrow_back' })).toBeTruthy();
  });
});
