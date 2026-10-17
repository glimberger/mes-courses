import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { typeOverrides } from '../theme/typography';
import {
  EmptyCategoryCard,
  type EmptyCategoryCardProps,
} from './EmptyCategoryCard';

const MESSAGE = 'Aucun article dans cette catégorie';

const renderCard = (
  theme: AppTheme,
  props: Partial<EmptyCategoryCardProps> = {},
) => {
  render(
    <PaperProvider theme={theme}>
      <EmptyCategoryCard
        testID="card"
        message={MESSAGE}
        actionLabel="Créer un article"
        onAction={jest.fn()}
        actionTestID="create-article"
        {...props}
      />
    </PaperProvider>,
  );
  return screen.getByTestId('card');
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('EmptyCategoryCard in the %s appearance', (_name, theme) => {
  it('is a card on surfaceContainerLowest with no tonal elevation', () => {
    const card = renderCard(theme);
    expect(card).toHaveStyle({
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderRadius: 16,
    });
    expect(StyleSheet.flatten(card.props.style).elevation).toBeUndefined();
  });

  it('is at least 56 dp high', () => {
    expect(renderCard(theme)).toHaveStyle({ minHeight: 56 });
  });

  it('sets the message in the emptyCategory size and weight, in onSurfaceVariant', () => {
    renderCard(theme);
    expect(screen.getByText(MESSAGE)).toHaveStyle({
      fontFamily: typeOverrides.emptyCategory.fontFamily,
      fontSize: typeOverrides.emptyCategory.fontSize,
      color: theme.colors.onSurfaceVariant,
    });
  });

  it('wraps a long message instead of truncating it', () => {
    renderCard(theme, {
      message: 'Un message très long qui doit passer à la ligne',
    });
    expect(
      screen.getByText('Un message très long qui doit passer à la ligne').props
        .numberOfLines,
    ).toBeUndefined();
  });

  it('offers a text button that runs onAction, with the caller testID', () => {
    const onAction = jest.fn();
    renderCard(theme, { onAction });
    fireEvent.press(screen.getByTestId('create-article'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Créer un article')).toBeTruthy();
  });
});
