import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { SearchField, type SearchFieldProps } from './SearchField';

const PLACEHOLDER = 'Rechercher un article';

/**
 * The style of an element and of its host ancestors, nearest first: Paper's Surface moves the
 * frame (height, margins) to an outer view and keeps the colors on the element with the testID.
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

const renderField = (
  theme: AppTheme,
  props: Partial<SearchFieldProps> = {},
) => {
  render(
    <PaperProvider theme={theme}>
      <SearchField
        placeholder={PLACEHOLDER}
        value=""
        onChangeText={jest.fn()}
        {...props}
      />
    </PaperProvider>,
  );
  return {
    container: screen.getByTestId('search-bar-container'),
    input: screen.getByPlaceholderText(PLACEHOLDER),
  };
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('SearchField in the %s appearance', (_name, theme) => {
  it('is a 54 dp stadium on surfaceContainer, 6 dp under the header and 16 dp from the sides', () => {
    const { container } = renderField(theme);
    expect(frameStyle(container)).toMatchObject({
      height: 54,
      borderRadius: 9999,
      backgroundColor: theme.colors.surfaceContainer,
      marginTop: 6,
      marginBottom: 2,
      marginHorizontal: 16,
    });
  });

  it('pads its content 18 dp at the sides and spaces the icon and the text 12 dp', () => {
    const { container } = renderField(theme);
    expect(frameStyle(container)).toMatchObject({
      paddingHorizontal: 18,
      gap: 12,
    });
  });

  it('sets the typed text and its placeholder in bodyLarge, muted', () => {
    const { input } = renderField(theme);
    expect(input).toHaveStyle({
      fontFamily: theme.fonts.bodyLarge.fontFamily,
      fontSize: theme.fonts.bodyLarge.fontSize,
    });
    expect(input.props.placeholderTextColor).toBe(
      theme.colors.onSurfaceVariant,
    );
  });

  it('draws its search icon in onSurfaceVariant', () => {
    renderField(theme);
    expect(
      screen.UNSAFE_getByProps({ testID: 'search-bar-icon' }).props.iconColor,
    ).toBe(theme.colors.onSurfaceVariant);
  });
});
