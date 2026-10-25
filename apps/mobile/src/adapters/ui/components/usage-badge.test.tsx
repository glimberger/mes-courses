import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { UsageBadge, usageLabel } from './UsageBadge';

const renderBadge = (theme: AppTheme, count: number, name = 'Pommes') =>
  render(
    <PaperProvider theme={theme}>
      <UsageBadge name={name} count={count} testID="badge" />
    </PaperProvider>,
  );

describe('usageLabel', () => {
  it('US5 says "dans 1 liste" for one list', () => {
    expect(usageLabel('Pommes', 1)).toBe('Pommes, dans 1 liste');
  });

  it('US5 says "dans <n> listes" for several lists', () => {
    expect(usageLabel('Beurre', 3)).toBe('Beurre, dans 3 listes');
  });
});

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('UsageBadge in the %s appearance', (_name, theme) => {
  it('US5 draws nothing at 0', () => {
    renderBadge(theme, 0);
    expect(screen.queryByTestId('badge')).toBeNull();
  });

  it('US5 shows the count on the secondary container, with the accessible label', () => {
    renderBadge(theme, 2);

    const badge = screen.getByTestId('badge');
    expect(screen.getByText('2')).toHaveStyle({
      color: theme.colors.onSecondaryContainer,
    });
    expect(badge).toHaveStyle({
      backgroundColor: theme.colors.secondaryContainer,
      borderRadius: 9999,
    });
    expect(badge.props.accessibilityLabel).toBe('Pommes, dans 2 listes');
  });

  it('US5 labels a single list in the singular', () => {
    renderBadge(theme, 1);
    expect(screen.getByTestId('badge').props.accessibilityLabel).toBe(
      'Pommes, dans 1 liste',
    );
  });
});
