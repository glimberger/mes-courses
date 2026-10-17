import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { Button, type ButtonProps } from './Button';

const renderButton = (theme: AppTheme, props: Partial<ButtonProps> = {}) => {
  const onPress = jest.fn();
  render(
    <PaperProvider theme={theme}>
      <Button onPress={onPress} testID="button" {...props}>
        Se connecter
      </Button>
    </PaperProvider>,
  );
  return { button: screen.getByTestId('button'), onPress };
};

const label = () => screen.getByText('Se connecter');

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('Button in the %s appearance', (_name, theme) => {
  it('is a stadium 50 dp high by default, with a 48 dp target', () => {
    const { button } = renderButton(theme, { mode: 'brand' });
    expect(button).toHaveStyle({ borderRadius: 9999, minHeight: 50 });
  });

  it('is 44 dp high when compact, and reaches 48 dp with a hit slop', () => {
    const { button } = renderButton(theme, {
      mode: 'outlined',
      size: 'compact',
    });
    expect(button).toHaveStyle({ minHeight: 44 });
    expect(button.props.hitSlop).toEqual({ top: 2, bottom: 2 });
  });

  it('draws brand with a primaryContainer fill and onPrimaryContainer text', () => {
    const { button } = renderButton(theme, { mode: 'brand' });
    expect(button).toHaveStyle({
      backgroundColor: theme.colors.primaryContainer,
    });
    expect(label()).toHaveStyle({ color: theme.colors.onPrimaryContainer });
  });

  it('draws outlined with a 1.5 dp outline border and primary text', () => {
    const { button } = renderButton(theme, { mode: 'outlined' });
    expect(button).toHaveStyle({
      borderWidth: 1.5,
      borderColor: theme.colors.outline,
    });
    expect(label()).toHaveStyle({ color: theme.colors.primary });
  });

  it('draws danger with a 1.5 dp error border, error text and error icon', () => {
    const { button } = renderButton(theme, { mode: 'danger', icon: 'delete' });
    expect(button).toHaveStyle({
      borderWidth: 1.5,
      borderColor: theme.colors.error,
    });
    expect(label()).toHaveStyle({ color: theme.colors.error });
    expect(
      screen.getByTestId('button').findByProps({ source: 'delete' }).props
        .color,
    ).toBe(theme.colors.error);
  });

  it('draws dangerFilled with an error fill and onError text', () => {
    const { button } = renderButton(theme, { mode: 'dangerFilled' });
    expect(button).toHaveStyle({ backgroundColor: theme.colors.error });
    expect(label()).toHaveStyle({ color: theme.colors.onError });
  });

  it('draws text with primary text and 14 dp horizontal padding, no fill', () => {
    const { button } = renderButton(theme, { mode: 'text' });
    expect(button).toHaveStyle({ paddingHorizontal: 14 });
    expect(label()).toHaveStyle({ color: theme.colors.primary });
  });

  it('sets a minimum height, not a fixed one, so a wrapped label is not cut', () => {
    const { button } = renderButton(theme, { mode: 'brand' });
    expect(StyleSheet.flatten(button.props.style).height).toBeUndefined();
  });

  it('keeps the label as the button name and calls onPress', () => {
    const { onPress } = renderButton(theme, { mode: 'brand' });
    fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled for assistive technology when disabled', () => {
    renderButton(theme, { mode: 'brand', disabled: true });
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeDisabled();
  });

  it('wraps a long label instead of truncating it', () => {
    renderButton(theme, { mode: 'brand' });
    expect(label().props.numberOfLines).toBeUndefined();
  });
});
