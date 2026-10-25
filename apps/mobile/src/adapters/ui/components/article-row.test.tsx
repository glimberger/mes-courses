import { fireEvent, render, screen } from '@testing-library/react-native';

import { lightTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { ArticleRow } from './ArticleRow';

const renderRow = ({
  name = 'Lait',
  added = false,
  onPress = jest.fn(),
}: {
  name?: string;
  added?: boolean;
  onPress?: () => void;
} = {}) => {
  render(
    <ThemeProvider>
      <ArticleRow name={name} added={added} onPress={onPress} />
    </ThemeProvider>,
  );
  return { onPress };
};

describe('ArticleRow', () => {
  it('AC1 shows the name, with the outline add toggle on the right and no cart icon', () => {
    renderRow();

    expect(screen.getByText('Lait')).toBeOnTheScreen();
    expect(screen.UNSAFE_getByProps({ name: 'add_circle' })).toBeTruthy();
    expect(screen.UNSAFE_queryByProps({ name: 'check_circle' })).toBeNull();
    expect(screen.UNSAFE_queryByProps({ name: 'shopping_cart' })).toBeNull();
    expect(screen.queryByText('Déjà dans la liste')).not.toBeOnTheScreen();
  });

  it('AC5 is one button, labelled "Ajouter <name>" until added', () => {
    renderRow();

    expect(
      screen.getByRole('button', { name: 'Ajouter Lait' }),
    ).toBeOnTheScreen();
  });

  it('AC1 AC5 shows the filled check toggle and the label "<name> ajoutée, toucher pour retirer" once added', () => {
    renderRow({ added: true });

    expect(screen.UNSAFE_getByProps({ name: 'check_circle' })).toBeTruthy();
    expect(screen.UNSAFE_queryByProps({ name: 'add_circle' })).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Lait ajoutée, toucher pour retirer',
      }),
    ).toBeOnTheScreen();
  });

  it('AC5 tints its card and border with theme tokens once added, and not before', () => {
    renderRow({ added: true });

    const { tertiaryContainer, onTertiaryContainer } = lightTheme.colors;
    expect(screen.getByTestId('article-row-card')).toHaveStyle({
      backgroundColor: tertiaryContainer,
      borderColor: onTertiaryContainer,
    });
  });

  it('leaves its border transparent before the article is added', () => {
    renderRow();

    expect(screen.getByTestId('article-row-card')).toHaveStyle({
      borderColor: lightTheme.colors.surfaceContainerLowest,
    });
  });

  it('FR-034 is at least 48 dp high', () => {
    renderRow();

    expect(screen.getByRole('button', { name: 'Ajouter Lait' })).toHaveStyle({
      minHeight: 48,
    });
  });

  it('calls onPress when tapped', () => {
    const { onPress } = renderRow({ added: true });

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Lait ajoutée, toucher pour retirer',
      }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has no menu and no accessibility actions: editing and deleting live in the Articles tab', () => {
    renderRow();

    expect(
      screen.queryByRole('button', { name: /Actions pour/ }),
    ).not.toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Ajouter Lait' }).props
        .accessibilityActions,
    ).toBeUndefined();
  });

  it('sets its name in titleMedium, and wraps a long name instead of truncating it', () => {
    renderRow({
      name: 'Yaourt à la grecque nature au lait entier de brebis bio x 12',
    });

    const name = screen.getByText(
      'Yaourt à la grecque nature au lait entier de brebis bio x 12',
    );
    expect(name).toHaveStyle({
      fontFamily: lightTheme.fonts.titleMedium.fontFamily,
    });
    expect(name.props.numberOfLines).toBeUndefined();
  });
});
