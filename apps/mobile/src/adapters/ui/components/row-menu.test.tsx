import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme/theme-provider';
import { waitForMenusToSettle } from '../testing/wait-for-menus';
import { RowMenu } from './RowMenu';

const renderMenu = () => {
  const onQuantity = jest.fn();
  const onRemove = jest.fn();
  render(
    <ThemeProvider>
      <RowMenu
        name="Lait"
        items={[
          {
            title: 'Quantité…',
            accessibilityLabel: 'Quantité de Lait',
            onPress: onQuantity,
          },
          {
            title: 'Retirer de la liste',
            accessibilityLabel: 'Retirer Lait de la liste',
            onPress: onRemove,
          },
        ]}
      />
    </ThemeProvider>,
  );
  return { onQuantity, onRemove };
};

describe('RowMenu', () => {
  it('FR-008 has a 48 dp button labelled with the article', () => {
    renderMenu();

    expect(
      screen.getByRole('button', { name: 'Actions pour Lait' }),
    ).toHaveStyle({ width: 48, height: 48 });
  });

  it('FR-008 opens on the button with exactly the given entries, labelled with the article', async () => {
    renderMenu();
    await waitForMenusToSettle();

    fireEvent.press(screen.getByRole('button', { name: 'Actions pour Lait' }));

    expect(await screen.findByLabelText('Quantité de Lait')).toBeOnTheScreen();
    expect(screen.getByLabelText('Retirer Lait de la liste')).toBeOnTheScreen();
    expect(screen.getByText('Quantité…')).toBeOnTheScreen();
    expect(screen.getByText('Retirer de la liste')).toBeOnTheScreen();
  });

  it('FR-008 runs the action of the chosen entry', async () => {
    const { onQuantity, onRemove } = renderMenu();
    await waitForMenusToSettle();
    fireEvent.press(screen.getByRole('button', { name: 'Actions pour Lait' }));

    fireEvent.press(await screen.findByLabelText('Retirer Lait de la liste'));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onQuantity).not.toHaveBeenCalled();
  });
});
