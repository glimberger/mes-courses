import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme/theme-provider';
import { ArticleRow } from './ArticleRow';

const renderRow = ({
  name = 'Lait',
  onList = false,
  onPress = jest.fn(),
  onEdit = jest.fn(),
  onDelete = jest.fn(),
}: {
  name?: string;
  onList?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
} = {}) => {
  render(
    <ThemeProvider>
      <ArticleRow
        name={name}
        onList={onList}
        onPress={onPress}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </ThemeProvider>,
  );
  return { onPress, onEdit, onDelete };
};

const MENU_BUTTON = "Plus d'actions pour « Lait »";

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

  it('002 FR-001 FR-004 opens a menu with "Modifier" and "Supprimer" from a trailing button', () => {
    renderRow();
    expect(screen.queryByText('Modifier')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: MENU_BUTTON }));

    expect(screen.getByText('Modifier')).toBeOnTheScreen();
    expect(screen.getByText('Supprimer')).toBeOnTheScreen();
  });

  it('002 FR-001 calls onEdit when "Modifier" is chosen', () => {
    const { onEdit, onDelete, onPress } = renderRow();

    fireEvent.press(screen.getByRole('button', { name: MENU_BUTTON }));
    fireEvent.press(screen.getByText('Modifier'));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('002 FR-004 calls onDelete when "Supprimer" is chosen', () => {
    const { onEdit, onDelete } = renderRow();

    fireEvent.press(screen.getByRole('button', { name: MENU_BUTTON }));
    fireEvent.press(screen.getByText('Supprimer'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('002 FR-034 has a menu button at least 48 dp square', () => {
    renderRow();

    expect(screen.getByRole('button', { name: MENU_BUTTON })).toHaveStyle({
      width: 48,
      height: 48,
    });
  });

  it('002 offers "Modifier" and "Supprimer" as accessibility actions of the row', () => {
    const { onEdit, onDelete } = renderRow();
    const row = screen.getByRole('button', { name: 'Lait' });

    expect(row.props.accessibilityActions).toEqual([
      { name: 'edit', label: 'Modifier' },
      { name: 'delete', label: 'Supprimer' },
    ]);
    fireEvent(row, 'accessibilityAction', {
      nativeEvent: { actionName: 'edit' },
    });
    fireEvent(row, 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows no menu button without onEdit and onDelete', () => {
    render(
      <ThemeProvider>
        <ArticleRow name="Lait" onList={false} onPress={jest.fn()} />
      </ThemeProvider>,
    );

    expect(
      screen.queryByRole('button', { name: MENU_BUTTON }),
    ).not.toBeOnTheScreen();
  });
});
