import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { CheckboxBox } from './BrandCheckbox';

const renderBox = (theme: AppTheme, checked: boolean) => {
  render(
    <PaperProvider theme={theme}>
      <CheckboxBox testID="box" checked={checked} />
    </PaperProvider>,
  );
  return { box: screen.getByTestId('box', { includeHiddenElements: true }) };
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('CheckboxBox in the %s appearance', (_name, theme) => {
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
    const { box } = renderBox(theme, false);
    expect(box).toHaveStyle({ borderColor: theme.colors.outline });
    expect(box).not.toHaveStyle({
      backgroundColor: theme.colors.primaryContainer,
    });
  });

  it('is checked on a primaryContainer fill with an onPrimaryContainer border and mark', () => {
    const { box } = renderBox(theme, true);
    expect(box).toHaveStyle({
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.onPrimaryContainer,
    });
    const mark = screen.UNSAFE_getByProps({ name: 'check' });
    expect(mark.props.weight).toBe(700);
    expect(mark.props.size).toBe(17);
    expect(mark.props.color).toBe(theme.colors.onPrimaryContainer);
  });
});
