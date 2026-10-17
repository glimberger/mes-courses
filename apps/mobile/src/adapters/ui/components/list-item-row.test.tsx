import type { ReactTestInstance } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Quantity } from '../../../domain/quantity';
import { LONG_ARTICLE_NAME } from '../testing/fixtures';
import { darkTheme, lightTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { ListItemRow } from './ListItemRow';

// The system scheme the row is drawn under; light unless a test says otherwise.
let mockColorScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme,
}));

afterEach(() => {
  mockColorScheme = 'light';
});

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

    // The marked box: the weight-700 check mark of the mockups.
    expect(
      screen.UNSAFE_queryAllByProps({ name: 'check', weight: 700 }),
    ).not.toHaveLength(0);
    expect(screen.getByText('Lait')).toHaveStyle({
      textDecorationLine: 'line-through',
    });
    expect(screen.getByText('2 L')).toHaveStyle({
      textDecorationLine: 'line-through',
    });
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)(
    'FR-035 shows a ticked item with a check mark and struck-through text under the %s theme',
    (scheme, theme) => {
      mockColorScheme = scheme;
      renderRow({ inCart: true, quantity: { amount: 2, unit: 'L' } });

      // Drawn under that theme: the ticked text takes its onSurfaceVariant.
      expect(screen.getByText('Lait')).toHaveStyle({
        color: theme.colors.onSurfaceVariant,
      });
      expect(
        screen.UNSAFE_queryAllByProps({ name: 'check', weight: 700 }),
      ).not.toHaveLength(0);
      expect(screen.getByText('Lait')).toHaveStyle({
        textDecorationLine: 'line-through',
      });
      expect(screen.getByText('2 L')).toHaveStyle({
        textDecorationLine: 'line-through',
      });
    },
  );

  it('FR-035 shows an item not in the cart with an empty box and plain text', () => {
    renderRow({ inCart: false });

    expect(
      screen.UNSAFE_queryAllByProps({ name: 'check', weight: 700 }),
    ).toHaveLength(0);
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

  it('keeps the quantity next to the name on one baseline, 10 dp apart (mockup 1)', () => {
    renderRow();

    const name = StyleSheet.flatten(screen.getByText('Lait').props.style);
    expect(name.flex).toBeUndefined();
    expect(name.flexShrink).toBe(1);
    const holder = screen
      .getByRole('checkbox')
      .findAll(
        (node) =>
          StyleSheet.flatten(node.props.style)?.alignItems === 'baseline',
      )[0];
    expect(StyleSheet.flatten(holder?.props.style)).toMatchObject({
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 10,
    });
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

  describe('when a sync changes the tick', () => {
    const synced = (inCart: boolean) => (
      <ThemeProvider>
        <ListItemRow
          name="Lait"
          quantity={{ amount: 2, unit: 'L' }}
          inCart={inCart}
          onToggle={jest.fn()}
        />
      </ThemeProvider>
    );
    const struck = { textDecorationLine: 'line-through' } as const;

    it('FR-035 FR-036 strikes the name and the quantity through, as a tap does', async () => {
      jest.useFakeTimers();
      try {
        const { rerender } = render(synced(false));
        rerender(synced(true));
        await act(async () => {
          jest.runAllTimers();
        });

        expect(screen.getByText('Lait')).toHaveStyle(struck);
        expect(screen.getByText('2 L')).toHaveStyle(struck);
      } finally {
        jest.useRealTimers();
      }
    });

    it('FR-035 shows the name and the quantity as not struck through again when unticked', async () => {
      jest.useFakeTimers();
      try {
        const { rerender } = render(synced(true));
        rerender(synced(false));
        await act(async () => {
          jest.runAllTimers();
        });

        expect(screen.getByText('Lait')).not.toHaveStyle(struck);
        expect(screen.getByText('2 L')).not.toHaveStyle(struck);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
