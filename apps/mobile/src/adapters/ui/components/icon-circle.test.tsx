import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { IconCircle, type IconCircleProps } from './IconCircle';

const renderCircle = (theme: AppTheme, props: IconCircleProps) => {
  render(
    <PaperProvider theme={theme}>
      <IconCircle testID="circle" {...props} />
    </PaperProvider>,
  );
  return screen.getByTestId('circle', { includeHiddenElements: true });
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('IconCircle in the %s appearance', (_name, theme) => {
  it.each([
    [44, 24],
    [56, 28],
  ] as const)('is a %i dp circle with a %i dp icon', (diameter, iconSize) => {
    const circle = renderCircle(theme, { icon: 'check', diameter });
    expect(circle).toHaveStyle({
      width: diameter,
      height: diameter,
      borderRadius: diameter / 2,
    });
    expect(screen.UNSAFE_getByProps({ source: 'check' }).props.size).toBe(
      iconSize,
    );
  });

  it('is brand by default: brandSoft fill and onBrandSoft icon', () => {
    const circle = renderCircle(theme, { icon: 'check' });
    expect(circle).toHaveStyle({ backgroundColor: theme.colors.brandSoft });
    expect(screen.UNSAFE_getByProps({ source: 'check' }).props.color).toBe(
      theme.colors.onBrandSoft,
    );
  });

  it('draws the error tone on errorContainer with onErrorContainer', () => {
    const circle = renderCircle(theme, { icon: 'delete', tone: 'error' });
    expect(circle).toHaveStyle({
      backgroundColor: theme.colors.errorContainer,
    });
    expect(screen.UNSAFE_getByProps({ source: 'delete' }).props.color).toBe(
      theme.colors.onErrorContainer,
    );
  });

  it('is decorative: hidden from assistive technology', () => {
    const circle = renderCircle(theme, { icon: 'check' });
    expect(circle.props.accessibilityElementsHidden).toBe(true);
    expect(circle.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
