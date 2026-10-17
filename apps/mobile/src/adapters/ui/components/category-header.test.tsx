import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { CategoryHeader } from './CategoryHeader';

const renderHeader = (theme: AppTheme, title = 'Fruits et légumes') => {
  render(
    <PaperProvider theme={theme}>
      <CategoryHeader title={title} />
    </PaperProvider>,
  );
  return {
    container: screen.getByTestId('category-header', {
      includeHiddenElements: true,
    }),
    bar: screen.getByTestId('category-bar', { includeHiddenElements: true }),
  };
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('CategoryHeader in the %s appearance', (_name, theme) => {
  it('draws a 4 x 16 dp primaryContainer bar with 2 dp ends', () => {
    const { bar } = renderHeader(theme);
    expect(bar).toHaveStyle({
      width: 4,
      height: 16,
      borderRadius: 2,
      backgroundColor: theme.colors.primaryContainer,
    });
  });

  it('pads 18 dp on top, 9 dp below and 20 dp on the sides, with a 9 dp gap', () => {
    const { container } = renderHeader(theme);
    expect(container).toHaveStyle({
      paddingTop: 18,
      paddingBottom: 9,
      paddingHorizontal: 20,
      gap: 9,
    });
  });

  it('sets the name as a header in titleSmall, onSurfaceVariant', () => {
    renderHeader(theme);
    const title = screen.getByRole('header', { name: 'Fruits et légumes' });
    expect(title).toHaveStyle({
      color: theme.colors.onSurfaceVariant,
      fontFamily: theme.fonts.titleSmall.fontFamily,
    });
    expect(title.props.numberOfLines).toBeUndefined();
  });
});
