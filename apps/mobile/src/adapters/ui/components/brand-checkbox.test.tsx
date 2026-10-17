import { PaperProvider } from 'react-native-paper';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { BrandCheckbox } from './BrandCheckbox';

const renderBox = (theme: AppTheme, checked: boolean, onPress = jest.fn()) => {
  render(
    <PaperProvider theme={theme}>
      <BrandCheckbox
        testID="box"
        checked={checked}
        onPress={onPress}
        accessibilityLabel="Lait"
      />
    </PaperProvider>,
  );
  return {
    target: screen.getByRole('checkbox', { name: 'Lait' }),
    box: screen.getByTestId('box', { includeHiddenElements: true }),
    onPress,
  };
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('BrandCheckbox in the %s appearance', (_name, theme) => {
  it('is a checkbox target of at least 48 dp', () => {
    const { target } = renderBox(theme, false);
    expect(target).toHaveStyle({ width: 48, height: 48 });
  });

  it('draws a 24 dp box with 7 dp corners and a 2 dp border', () => {
    const { box } = renderBox(theme, false);
    expect(box).toHaveStyle({
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
    });
  });

  it('is unchecked with an outline border and no fill', () => {
    const { box, target } = renderBox(theme, false);
    expect(box).toHaveStyle({ borderColor: theme.colors.outline });
    expect(box).not.toHaveStyle({
      backgroundColor: theme.colors.primaryContainer,
    });
    expect(target).not.toBeChecked();
  });

  it('is checked on a primaryContainer fill with an onPrimaryContainer border and mark', () => {
    const { box, target } = renderBox(theme, true);
    expect(box).toHaveStyle({
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.onPrimaryContainer,
    });
    expect(target).toBeChecked();
    const mark = screen.UNSAFE_getByProps({ name: 'check' });
    expect(mark.props.weight).toBe(700);
    expect(mark.props.size).toBe(17);
    expect(mark.props.color).toBe(theme.colors.onPrimaryContainer);
  });

  it('calls onPress when pressed', () => {
    const { target, onPress } = renderBox(theme, false);
    fireEvent.press(target);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
