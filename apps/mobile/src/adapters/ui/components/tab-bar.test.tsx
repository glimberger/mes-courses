import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { AppIcon } from '../icons/AppIcon';
import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { TabBar, TAB_BAR_HEIGHT, type TabBarProps } from './TabBar';

const TABS = [
  { key: 'a', label: 'Courses', icon: 'shopping_cart' },
  { key: 'b', label: 'Listes', icon: 'format_list_bulleted' },
  { key: 'c', label: 'Articles', icon: 'grocery' },
  { key: 'd', label: 'Réglages', icon: 'settings' },
];

const renderBar = (theme: AppTheme, props: Partial<TabBarProps> = {}) => {
  const onSelect = jest.fn();
  render(
    <PaperProvider theme={theme} settings={{ icon: AppIcon }}>
      <TabBar
        tabs={TABS}
        selectedKey="a"
        onSelect={onSelect}
        testID="bar"
        {...props}
      />
    </PaperProvider>,
  );
  return { onSelect };
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('TabBar in the %s appearance', (_name, theme) => {
  it('draws the four labels on surfaceContainer', () => {
    renderBar(theme);

    for (const { label } of TABS) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('bar')).toHaveStyle({
      backgroundColor: theme.colors.surfaceContainer,
    });
  });

  it('exposes each tab as a tab with its label, and announces the selected one', () => {
    renderBar(theme, { selectedKey: 'b' });

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Listes' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Courses' })).not.toBeSelected();
  });

  it('marks the selected tab with a primaryContainer pill and onSurface text', () => {
    renderBar(theme, { selectedKey: 'c' });

    expect(screen.getByTestId('tab-pill-c')).toHaveStyle({
      backgroundColor: theme.colors.primaryContainer,
      width: 64,
      height: 32,
      borderRadius: 16,
    });
    expect(screen.getByTestId('tab-pill-a')).toHaveStyle({
      backgroundColor: theme.colors.surfaceContainer,
    });
    expect(screen.getByText('Articles')).toHaveStyle({
      color: theme.colors.onSurface,
    });
    expect(screen.getByText('Courses')).toHaveStyle({
      color: theme.colors.onSurfaceVariant,
    });
  });

  it('selects the tab pressed', () => {
    const { onSelect } = renderBar(theme);

    fireEvent.press(screen.getByRole('tab', { name: 'Réglages' }));

    expect(onSelect).toHaveBeenCalledWith('d');
  });

  it('reports a press on the selected tab too, so its stack can return to its root', () => {
    const { onSelect } = renderBar(theme);

    fireEvent.press(screen.getByRole('tab', { name: 'Courses' }));

    expect(onSelect).toHaveBeenCalledWith('a');
  });
});

it('is 80 dp high, as the mockups', () => {
  renderBar(lightTheme);

  expect(TAB_BAR_HEIGHT).toBe(80);
  expect(screen.getByTestId('bar')).toHaveStyle({ minHeight: 80 });
});
