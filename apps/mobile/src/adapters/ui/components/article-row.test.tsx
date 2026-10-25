import { fireEvent, render, screen } from '@testing-library/react-native';

import { lightTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { ArticleRow } from './ArticleRow';

const renderRow = ({
  name = 'Lait',
  onList = false,
  onPress = jest.fn(),
}: {
  name?: string;
  onList?: boolean;
  onPress?: () => void;
} = {}) => {
  render(
    <ThemeProvider>
      <ArticleRow name={name} onList={onList} onPress={onPress} />
    </ThemeProvider>,
  );
  return { onPress };
};

describe('ArticleRow', () => {
  it('shows the name, as one button, without the chip for an article not on the list', () => {
    renderRow();

    expect(screen.getByText('Lait')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lait' })).toBeOnTheScreen();
    expect(screen.queryByText('Déjà dans la liste')).not.toBeOnTheScreen();
  });

  it('US2-8 FR-011 shows the "Déjà dans la liste" chip, also read by screen readers, for an article on the list', () => {
    renderRow({ onList: true });

    expect(
      screen.getByText('Déjà dans la liste', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Lait, déjà dans la liste' }),
    ).toBeOnTheScreen();
  });

  it('FR-034 is at least 48 dp high', () => {
    renderRow();

    expect(screen.getByRole('button', { name: 'Lait' })).toHaveStyle({
      minHeight: 48,
    });
  });

  it('calls onPress when tapped', () => {
    const { onPress } = renderRow({ onList: true });

    fireEvent.press(
      screen.getByRole('button', { name: 'Lait, déjà dans la liste' }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('AC6 has no menu and no accessibility actions: editing and deleting live in the Articles tab', () => {
    renderRow();

    expect(
      screen.queryByRole('button', { name: /Actions pour/ }),
    ).not.toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Lait' }).props.accessibilityActions,
    ).toBeUndefined();
  });
});

describe('ArticleRow in the mockup look', () => {
  it('draws the add icon of an article not on the list in onBrandSoft, in its brand circle', () => {
    renderRow({ onList: false });

    expect(screen.UNSAFE_getByProps({ source: 'add' }).props.color).toBe(
      lightTheme.colors.onBrandSoft,
    );
  });

  it('shows no add icon for an article already on the list', () => {
    renderRow({ onList: true });

    expect(screen.UNSAFE_queryByProps({ source: 'add' })).toBeNull();
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
