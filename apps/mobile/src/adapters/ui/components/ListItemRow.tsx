import { memo, type Ref } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type HostInstance,
} from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import type { Quantity } from '../../../domain/quantity';
import type { AppTheme } from '../theme/theme';
import { typeOverrides } from '../theme/typography';
import { CheckboxBox } from './BrandCheckbox';
import { Card } from './Card';
import { formatQuantity } from './format-quantity';
import { paperRef } from './paper-ref';
import { RowMenu, type RowMenuItem } from './RowMenu';

// The mockups' row measures (`.row`), off the 4 dp grid.
const ROW_MIN_HEIGHT = 64;

export type ListItemRowProps = {
  name: string;
  quantity: Quantity | null;
  inCart: boolean;
  onToggle: () => void;
  /** Shows the menu entry "Quantité…" (US2-3). */
  onEditQuantity?: () => void;
  /** Shows the action "Retirer de la liste" (US2-6). */
  onRemove?: () => void;
  /** Opens the ⋮ menu when first shown (stories and screenshots). */
  menuInitiallyOpen?: boolean;
  /** The checkbox screen readers focus, for a focus move (FR-037). */
  ref?: Ref<HostInstance>;
};

/** "Lait, 2 L, dans le caddie" (FR-032). */
const label = ({
  name,
  quantity,
  inCart,
}: Pick<ListItemRowProps, 'name' | 'quantity' | 'inCart'>) =>
  [
    name,
    ...(quantity === null ? [] : [formatQuantity(quantity)]),
    inCart ? 'dans le caddie' : 'pas dans le caddie',
  ].join(', ');

const EDIT_QUANTITY = 'editQuantity';
const REMOVE = 'remove';

/**
 * One item of a list, ticked or unticked by a tap on the square checkbox at its start. The
 * trailing ⋮ menu offers "Quantité…" and "Retirer de la liste" (011 FR-008); screen readers reach
 * the same two as accessibility actions of the checkbox (FR-032). A ticked item shows a check
 * mark and a struck-through name (011 FR-009) in `onSurfaceVariant`, never a lower opacity, so
 * its contrast is the one the theme test checks (FR-036). The name wraps (FR-033) and the row is
 * at least 48 dp high (FR-034).
 */
export const ListItemRow = memo(function ListItemRow({
  name,
  quantity,
  inCart,
  onToggle,
  onEditQuantity,
  onRemove,
  menuInitiallyOpen,
  ref,
}: ListItemRowProps) {
  const { colors, fonts } = useTheme() as AppTheme;
  const textStyle = [
    { color: inCart ? colors.onSurfaceVariant : colors.onSurface },
    inCart && {
      fontFamily: fonts.bodyLarge.fontFamily,
      textDecorationLine: 'line-through' as const,
    },
  ];
  const actions = [
    ...(onEditQuantity ? [{ name: EDIT_QUANTITY, label: 'Quantité…' }] : []),
    ...(onRemove ? [{ name: REMOVE, label: 'Retirer de la liste' }] : []),
  ];
  const menuItems: RowMenuItem[] = [
    ...(onEditQuantity
      ? [
          {
            title: 'Quantité…',
            accessibilityLabel: `Quantité de ${name}`,
            onPress: onEditQuantity,
          },
        ]
      : []),
    ...(onRemove
      ? [
          {
            title: 'Retirer de la liste',
            accessibilityLabel: `Retirer ${name} de la liste`,
            onPress: onRemove,
          },
        ]
      : []),
  ];
  const onAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === EDIT_QUANTITY) onEditQuantity?.();
    if (nativeEvent.actionName === REMOVE) onRemove?.();
  };

  return (
    <Card style={styles.row}>
      <TouchableRipple
        ref={paperRef(ref)}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: inCart }}
        accessibilityLabel={label({ name, quantity, inCart })}
        accessibilityActions={actions.length > 0 ? actions : undefined}
        onAccessibilityAction={actions.length > 0 ? onAction : undefined}
        style={styles.checkboxArea}
      >
        <View style={styles.content}>
          <CheckboxBox checked={inCart} />
          <View style={styles.text}>
            {/* Remounted per tick state: Android kept a stale text style. */}
            <Text
              key={`name-${inCart}`}
              variant="titleMedium"
              style={[styles.name, ...textStyle]}
            >
              {name}
            </Text>
            {quantity !== null && (
              <Text
                style={[styles.quantity, { color: colors.onSurfaceVariant }]}
              >
                {formatQuantity(quantity)}
              </Text>
            )}
          </View>
        </View>
      </TouchableRipple>
      {menuItems.length > 0 && (
        <RowMenu
          name={name}
          items={menuItems}
          defaultVisible={menuInitiallyOpen ?? false}
        />
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: 8,
    paddingEnd: 6,
    paddingStart: 14,
    marginBottom: 10,
  },
  checkboxArea: { flex: 1, minHeight: 48, justifyContent: 'center' },
  // The box is centered on the row, however many lines the name takes.
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // The name and the quantity share a baseline, 10 dp apart, and wrap together.
  text: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 10,
  },
  name: { flexShrink: 1 },
  quantity: typeOverrides.quantity,
});
