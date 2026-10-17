import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { shadows } from '../theme/elevation';
import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { BrandImage } from './BrandImage';

const renderImage = (theme: AppTheme) => {
  render(
    <PaperProvider theme={theme}>
      <BrandImage onError={jest.fn()} />
    </PaperProvider>,
  );
  return screen.getByTestId('sign-in-brand-image');
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('BrandImage in the %s appearance', (_name, theme) => {
  it('is a 215 dp square with 40 dp corners', () => {
    expect(renderImage(theme)).toHaveStyle({
      width: 215,
      height: 215,
      borderRadius: 40,
    });
  });

  it('casts the brand tile shadow, built from theme roles', () => {
    expect(renderImage(theme)).toHaveStyle({
      boxShadow: shadows(theme).brandTile,
    });
  });

  it('keeps the logo cropped to fill its square', () => {
    expect(renderImage(theme).props.resizeMode).toBe('cover');
  });

  it('is read as the brand name, an image', () => {
    const image = renderImage(theme);
    expect(image.props.accessibilityLabel).toBe('Mes Courses');
    expect(image.props.accessibilityRole).toBe('image');
    expect(StyleSheet.flatten(image.props.style).elevation).toBeUndefined();
  });
});
