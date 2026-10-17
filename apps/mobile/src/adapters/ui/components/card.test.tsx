import { StyleSheet, Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { shadows } from '../theme/elevation';
import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { Card, type CardProps } from './Card';

const renderCard = (theme: AppTheme, props: Partial<CardProps> = {}) => {
  render(
    <PaperProvider theme={theme}>
      <Card testID="card" {...props}>
        <Text>Contenu</Text>
      </Card>
    </PaperProvider>,
  );
  return screen.getByTestId('card');
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('Card in the %s appearance', (_name, theme) => {
  it('sits on surfaceContainerLowest with a 16 dp radius and the card shadow', () => {
    expect(renderCard(theme)).toHaveStyle({
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderRadius: 16,
      boxShadow: shadows(theme).card,
    });
  });

  it('keeps no tonal elevation', () => {
    const style = StyleSheet.flatten(renderCard(theme).props.style);
    expect(style.elevation).toBeUndefined();
  });

  it('draws a 2 dp primaryContainer border when outlined', () => {
    expect(renderCard(theme, { outlined: true })).toHaveStyle({
      borderWidth: 2,
      borderColor: theme.colors.primaryContainer,
    });
  });

  it('draws no border when not outlined', () => {
    const style = StyleSheet.flatten(renderCard(theme).props.style);
    expect(style.borderWidth).toBeUndefined();
  });
});
