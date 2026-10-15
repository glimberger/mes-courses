import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/theme-provider';
import { StartupSplash } from './StartupSplash';

const renderSplash = () =>
  render(
    <ThemeProvider>
      <StartupSplash />
    </ThemeProvider>,
  );

describe('StartupSplash', () => {
  it('shows the Mes Courses identity without offering an action', () => {
    renderSplash();

    expect(screen.getByTestId('startup-splash-image')).toBeOnTheScreen();
    expect(
      screen.getByRole('image', { name: 'Mes Courses' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('shows the French identity when the branded image cannot render', () => {
    renderSplash();

    fireEvent(screen.getByTestId('startup-splash-image'), 'error');

    expect(screen.getByText('Mes Courses')).toBeOnTheScreen();
  });
});
