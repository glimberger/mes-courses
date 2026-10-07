import type { ReactTestInstance } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Quantity } from '../../../domain/quantity';
import { LONG_ARTICLE_NAME } from '../testing/fixtures';
import { lightTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { ListItemRow } from './ListItemRow';

const renderRow = ({
  name = 'Lait',
  quantity = null,
  inCart = false,
  onToggle = jest.fn(),
}: {
  name?: string;
  quantity?: Quantity | null;
  inCart?: boolean;
  onToggle?: () => void;
} = {}) => {
  render(
    <ThemeProvider>
      <ListItemRow
        name={name}
        quantity={quantity}
        inCart={inCart}
        onToggle={onToggle}
      />
    </ThemeProvider>,
  );
  return { onToggle };
};

/** Every host element from `node` down, `node` included. */
const subtree = (node: ReactTestInstance): ReactTestInstance[] => [
  node,
  ...node.children.flatMap((child) =>
    typeof child === 'string' ? [] : subtree(child),
  ),
];

describe('ListItemRow', () => {
  it('FR-032 is one checkbox with the checked state of the item', () => {
    renderRow({ inCart: true });

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('FR-032 is not checked when the item is not in the cart', () => {
    renderRow({ inCart: false });

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it.each([
    [
      { name: 'Lait', quantity: { amount: 2, unit: 'L' }, inCart: true },
      'Lait, 2 L, dans le caddie',
    ],
    [
      { name: 'Pommes', quantity: null, inCart: false },
      'Pommes, pas dans le caddie',
    ],
    [
      { name: 'Farine', quantity: { amount: 1.5, unit: 'kg' }, inCart: false },
      'Farine, 1,5 kg, pas dans le caddie',
    ],
  ])('FR-032 is labelled from %o as "%s"', (item, label) => {
    renderRow(item);

    expect(screen.getByRole('checkbox', { name: label })).toBeOnTheScreen();
  });

  it('US1-1 shows the name and the quantity', () => {
    renderRow({ name: 'Lait', quantity: { amount: 2, unit: 'L' } });

    expect(screen.getByText('Lait')).toBeOnTheScreen();
    expect(screen.getByText('2 L')).toBeOnTheScreen();
  });

  it('FR-035 shows a ticked item with a check mark and struck-through text, not only a color', () => {
    renderRow({ inCart: true, quantity: { amount: 2, unit: 'L' } });

    // The marked box icon, as Paper's checkbox draws it.
    expect(
      screen.UNSAFE_queryAllByProps({ name: 'checkbox-marked' }),
    ).not.toHaveLength(0);
    expect(screen.getByText('Lait')).toHaveStyle({
      textDecorationLine: 'line-through',
    });
    expect(screen.getByText('2 L')).toHaveStyle({
      textDecorationLine: 'line-through',
    });
  });

  it('FR-035 shows an item not in the cart with an empty box and plain text', () => {
    renderRow({ inCart: false });

    expect(
      screen.UNSAFE_queryAllByProps({ name: 'checkbox-marked' }),
    ).toHaveLength(0);
    expect(
      screen.UNSAFE_queryAllByProps({ name: 'checkbox-blank-outline' }),
    ).not.toHaveLength(0);
    expect(screen.getByText('Lait')).not.toHaveStyle({
      textDecorationLine: 'line-through',
    });
  });

  it('FR-036 draws a ticked item in onSurfaceVariant, with no opacity, so its contrast is the one the theme checks', () => {
    renderRow({ inCart: true, quantity: { amount: 2, unit: 'L' } });

    expect(screen.getByText('Lait')).toHaveStyle({
      color: lightTheme.colors.onSurfaceVariant,
    });
    expect(screen.getByText('2 L')).toHaveStyle({
      color: lightTheme.colors.onSurfaceVariant,
    });
    const opacities = subtree(screen.getByRole('checkbox'))
      .map((node) => StyleSheet.flatten(node.props.style)?.opacity)
      .filter((opacity) => opacity !== undefined && opacity !== 1);
    expect(opacities).toEqual([]);
  });

  it('FR-036 draws an item not in the cart in onSurface', () => {
    renderRow({ inCart: false });

    expect(screen.getByText('Lait')).toHaveStyle({
      color: lightTheme.colors.onSurface,
    });
  });

  it('FR-034 is at least 48 dp high', () => {
    renderRow();

    expect(screen.getByRole('checkbox')).toHaveStyle({ minHeight: 48 });
  });

  it('FR-033 wraps a long name instead of cutting it', () => {
    renderRow({ name: LONG_ARTICLE_NAME });

    expect(screen.getByText(LONG_ARTICLE_NAME).props.numberOfLines).toBe(
      undefined,
    );
  });

  it('US1-2 calls onToggle when tapped', () => {
    const { onToggle } = renderRow();

    fireEvent.press(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
