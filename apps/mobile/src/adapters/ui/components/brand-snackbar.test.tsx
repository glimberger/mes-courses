import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { shadows } from '../theme/elevation';
import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { typeOverrides } from '../theme/typography';
import { BrandSnackbar } from './BrandSnackbar';

/**
 * The style of an element and of its host ancestors: Paper's Surface moves the frame (margins,
 * height) to an outer view and keeps the colors and paddings on the element with the testID.
 */
const frameStyle = (element: ReactTestInstance) => {
  const styles: object[] = [];
  for (let node: ReactTestInstance | null = element; node; node = node.parent) {
    if (typeof node.type === 'string') {
      styles.push(StyleSheet.flatten(node.props.style));
    }
  }
  return Object.assign({}, ...styles.reverse());
};

const MESSAGE = '« Lait » retiré de la liste';

const renderSnackbar = (theme: AppTheme) => {
  render(
    <PaperProvider theme={theme}>
      <BrandSnackbar
        testID="brand-snackbar"
        visible
        onDismiss={jest.fn()}
        action={{ label: 'Annuler', onPress: jest.fn() }}
      >
        {MESSAGE}
      </BrandSnackbar>
    </PaperProvider>,
  );
  return screen.getByTestId('brand-snackbar');
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('BrandSnackbar in the %s appearance', (_name, theme) => {
  it('is a 16 dp corner bar on inverseSurface with the snackbar shadow, 56 dp at least', () => {
    const bar = renderSnackbar(theme);
    expect(frameStyle(bar)).toMatchObject({
      backgroundColor: theme.colors.inverseSurface,
      borderRadius: 16,
      boxShadow: shadows(theme).snackbar,
      minHeight: 56,
    });
  });

  it('pads 8 dp top and bottom, 18 dp at the start and 6 dp at the end', () => {
    const bar = renderSnackbar(theme);
    expect(frameStyle(bar)).toMatchObject({
      paddingTop: 8,
      paddingBottom: 8,
      paddingStart: 18,
      paddingEnd: 6,
    });
  });

  it('sits 16 dp from each side of the screen', () => {
    const bar = renderSnackbar(theme);
    expect(frameStyle(bar)).toMatchObject({ marginHorizontal: 16 });
  });

  it('sets the message in the snackbarMessage role, in inverseOnSurface', () => {
    renderSnackbar(theme);
    expect(screen.getByText(MESSAGE)).toHaveStyle({
      fontFamily: typeOverrides.snackbarMessage.fontFamily,
      fontSize: typeOverrides.snackbarMessage.fontSize,
      color: theme.colors.inverseOnSurface,
    });
  });

  it('wraps a long message instead of truncating it', () => {
    renderSnackbar(theme);
    expect(screen.getByText(MESSAGE).props.numberOfLines).toBeUndefined();
  });

  it('sets the action label at compactLabel size, in inversePrimary', () => {
    renderSnackbar(theme);
    expect(screen.getByText('Annuler')).toHaveStyle({
      fontSize: typeOverrides.compactLabel.fontSize,
      color: theme.colors.inversePrimary,
    });
  });
});
