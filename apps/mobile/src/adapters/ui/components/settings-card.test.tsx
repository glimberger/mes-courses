import { StyleSheet, Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { shadows } from '../theme/elevation';
import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { SettingsCard, type SettingsCardProps } from './SettingsCard';

const renderCard = (
  theme: AppTheme,
  props: Partial<SettingsCardProps> = {},
) => {
  render(
    <PaperProvider theme={theme}>
      <SettingsCard testID="card" {...props}>
        <Text>Compte</Text>
      </SettingsCard>
    </PaperProvider>,
  );
  return screen.getByTestId('card');
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('SettingsCard in the %s appearance', (_name, theme) => {
  it('is a card on surfaceContainerLowest with the card shadow and no tonal elevation', () => {
    const card = renderCard(theme);
    expect(card).toHaveStyle({
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderRadius: 16,
      boxShadow: shadows(theme).card,
    });
    expect(StyleSheet.flatten(card.props.style).elevation).toBeUndefined();
  });

  it('pads 16 dp and spaces its rows 14 dp apart', () => {
    expect(renderCard(theme)).toHaveStyle({ padding: 16, gap: 14 });
  });

  it('spaces its rows 10 dp apart when dense, as the actions card', () => {
    expect(renderCard(theme, { dense: true })).toHaveStyle({ gap: 10 });
  });
});
