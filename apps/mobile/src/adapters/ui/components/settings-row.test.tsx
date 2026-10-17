import { PaperProvider } from 'react-native-paper';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { SettingsRow, type SettingsRowProps } from './SettingsRow';

const renderRow = (theme: AppTheme, props: Partial<SettingsRowProps> = {}) => {
  render(
    <PaperProvider theme={theme}>
      <SettingsRow
        icon="account_circle"
        title="Marie"
        subtitle="marie@example.org"
        {...props}
      />
    </PaperProvider>,
  );
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('SettingsRow in the %s appearance', (_name, theme) => {
  it('draws a 44 dp brand circle with its icon at 24 dp', () => {
    renderRow(theme);
    expect(
      screen.UNSAFE_getByProps({ source: 'account_circle' }).props.size,
    ).toBe(24);
  });

  it('sets the title in titleMedium and the subtitle in bodySmall, muted', () => {
    renderRow(theme);
    expect(screen.getByText('Marie')).toHaveStyle({
      fontFamily: theme.fonts.titleMedium.fontFamily,
    });
    expect(screen.getByText('marie@example.org')).toHaveStyle({
      fontFamily: theme.fonts.bodySmall.fontFamily,
      color: theme.colors.onSurfaceVariant,
    });
  });

  it('draws no surface of its own: its card gives it the background', () => {
    renderRow(theme);
    expect(screen.UNSAFE_queryAllByProps({ elevation: 1 })).toHaveLength(0);
  });

  it('ends with a muted chevron_right when it opens something', () => {
    renderRow(theme, { onPress: jest.fn(), chevron: true });
    expect(
      screen.UNSAFE_getByProps({ source: 'chevron_right' }).props.color,
    ).toBe(theme.colors.onSurfaceVariant);
  });

  it('is a button named by its title, and calls onPress', () => {
    const onPress = jest.fn();
    renderRow(theme, { onPress });
    fireEvent.press(screen.getByRole('button', { name: 'Marie' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('wraps a long title instead of truncating it', () => {
    renderRow(theme, {
      title: 'Un nom de compte très long qui passe à la ligne',
    });
    expect(
      screen.getByText('Un nom de compte très long qui passe à la ligne').props
        .numberOfLines,
    ).toBeUndefined();
  });
});
