import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/theme-provider';
import { StartupSplash } from './StartupSplash';

let mockColorScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme,
}));

const renderSplash = (scheme: 'light' | 'dark' | null = 'light') => {
  mockColorScheme = scheme;
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 24, right: 0, bottom: 16, left: 0 },
      }}
    >
      <ThemeProvider>
        <StartupSplash />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
};

describe('StartupSplash', () => {
  it.each(['light', 'dark'] as const)(
    'renders the complete identity with the %s Material theme',
    (scheme) => {
      renderSplash(scheme);

      expect(
        screen.getByRole('image', { name: 'Mes Courses' }),
      ).toBeOnTheScreen();
    },
  );

  it('keeps the asset contained and the content inset-safe on narrow layouts', () => {
    renderSplash();

    expect(screen.getByTestId('startup-splash-container')).toHaveStyle({
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(screen.getByTestId('startup-splash-image')).toHaveProp(
      'resizeMode',
      'contain',
    );
    expect(screen.getByTestId('startup-splash-image')).toHaveStyle({
      flex: 1,
    });
  });

  it('exposes the French identity to assistive technologies', () => {
    renderSplash();

    expect(
      screen.getByRole('image', { name: 'Mes Courses' }),
    ).toBeOnTheScreen();
  });

  it('shows the Mes Courses identity without offering an action', () => {
    renderSplash();

    expect(screen.getByTestId('startup-splash-image')).toBeOnTheScreen();
    expect(
      screen.getByRole('image', { name: 'Mes Courses' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('renders a visible fallback after an image error', () => {
    renderSplash();
    fireEvent(screen.getByTestId('startup-splash-image'), 'error');

    expect(screen.getByText('Mes Courses')).toBeOnTheScreen();
  });
});
