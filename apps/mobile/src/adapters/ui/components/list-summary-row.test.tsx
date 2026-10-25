import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { ListSummaryRow, type ListSummaryRowProps } from './ListSummaryRow';

const renderRow = (theme: AppTheme, props: Partial<ListSummaryRowProps>) => {
  render(
    <PaperProvider theme={theme}>
      <ListSummaryRow
        name="Ma liste"
        itemCount={4}
        isCurrent={false}
        onPress={jest.fn()}
        testID="card"
        {...props}
      />
    </PaperProvider>,
  );
  return screen.getByRole('button');
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('ListSummaryRow in the %s appearance', (_name, theme) => {
  it('is a card on surfaceContainerLowest with no tonal elevation', () => {
    renderRow(theme, {});
    const card = screen.getByTestId('card');
    expect(card).toHaveStyle({
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderRadius: 16,
    });
    expect(StyleSheet.flatten(card.props.style).elevation).toBeUndefined();
  });

  it('draws a 2 dp brand border only on the current list', () => {
    renderRow(theme, { isCurrent: true });
    expect(screen.getByTestId('card')).toHaveStyle({
      borderWidth: 2,
      borderColor: theme.colors.primaryContainer,
    });
  });

  it('draws no border on a list that is not current', () => {
    renderRow(theme, { isCurrent: false });
    expect(
      StyleSheet.flatten(screen.getByTestId('card').props.style).borderWidth,
    ).toBeUndefined();
  });

  it('leads with a 44 dp brand circle holding format_list_bulleted', () => {
    renderRow(theme, {});
    expect(
      screen.UNSAFE_getByProps({ source: 'format_list_bulleted' }).props.size,
    ).toBe(24);
  });

  it('sets the name in titleMedium and the count in bodySmall, muted', () => {
    renderRow(theme, { name: 'Barbecue', itemCount: 4 });
    expect(screen.getByText('Barbecue')).toHaveStyle({
      fontFamily: theme.fonts.titleMedium.fontFamily,
      fontSize: theme.fonts.titleMedium.fontSize,
    });
    expect(screen.getByText('4 articles')).toHaveStyle({
      fontFamily: theme.fonts.bodySmall.fontFamily,
      color: theme.colors.onSurfaceVariant,
    });
  });

  it('ends with a chevron_right when the list is not current', () => {
    renderRow(theme, { isCurrent: false });
    expect(
      screen.UNSAFE_getByProps({ source: 'chevron_right' }).props.color,
    ).toBe(theme.colors.onSurfaceVariant);
    expect(screen.queryByText('en cours')).toBeNull();
  });

  it('ends with the brand chip "en cours" when the list is current', () => {
    renderRow(theme, { isCurrent: true });
    expect(screen.getByText('en cours')).toBeTruthy();
    expect(screen.UNSAFE_queryByProps({ source: 'chevron_right' })).toBeNull();
  });

  it('wraps a long name instead of truncating it', () => {
    renderRow(theme, { name: 'Une liste aux noms très très longs' });
    expect(
      screen.getByText('Une liste aux noms très très longs').props
        .numberOfLines,
    ).toBeUndefined();
  });

  it('reads as one label and calls onPress when tapped', () => {
    const onPress = jest.fn();
    const row = renderRow(theme, {
      name: 'Barbecue',
      itemCount: 0,
      isCurrent: true,
      onPress,
    });
    expect(row.props.accessibilityLabel).toBe(
      'Barbecue, 0 articles, liste en cours',
    );
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
