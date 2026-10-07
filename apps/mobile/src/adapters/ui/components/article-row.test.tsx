import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme/theme-provider';
import { ArticleRow } from './ArticleRow';

const renderRow = ({
  name = 'Lait',
  onList = false,
  onPress = jest.fn(),
}: { name?: string; onList?: boolean; onPress?: () => void } = {}) => {
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

    expect(screen.getByRole('button')).toHaveStyle({ minHeight: 48 });
  });

  it('calls onPress when tapped', () => {
    const { onPress } = renderRow({ onList: true });

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
