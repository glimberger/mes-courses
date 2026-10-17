import { memo, type Ref } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type HostInstance,
} from 'react-native';
import {
  IconButton,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import type { Quantity } from '../../../domain/quantity';
import type { AppTheme } from '../theme/theme';
import { typeOverrides } from '../theme/typography';
import { CheckboxBox } from './BrandCheckbox';
import { Card } from './Card';
import { formatQuantity } from './format-quantity';
import { paperRef } from './paper-ref';

// The mockups' row measures (`.row`), off the 4 dp grid.
const ROW_MIN_HEIGHT = 64;

export type ListItemRowProps = {
  name: string;
  quantity: Quantity | null;
  inCart: boolean;
  onToggle: () => void;
  /** Shows the action "Modifier la quantité" (US2-3). */
  onEditQuantity?: () => void;
  /** Shows the action "Retirer de la liste" (US2-6). */
  onRemove?: () => void;
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
 * One item of a list, ticked or unticked by a tap. The checkbox, the whole row but its trailing
 * actions, is the one element screen readers see: they reach "Modifier la quantité" and
 * "Retirer de la liste" as its accessibility actions (FR-032), so the trailing buttons are hidden
 * from them. A ticked item shows a check mark and struck-through text in `onSurfaceVariant`,
 * never a lower opacity, so its contrast is the one the theme test checks (FR-035, FR-036). The
 * name wraps (FR-033) and the row is at least 48 dp high (FR-034).
 */
export const ListItemRow = memo(function ListItemRow({
  name,
  quantity,
  inCart,
  onToggle,
  onEditQuantity,
  onRemove,
  ref,
}: ListItemRowProps) {
  const { colors, fonts } = useTheme() as AppTheme;
  const textStyle = [
    { color: inCart ? colors.onSurfaceVariant : colors.onSurface },
    inCart && styles.ticked,
    inCart && { fontFamily: fonts.bodyLarge.fontFamily },
  ];
  const actions = [
    ...(onEditQuantity
      ? [{ name: EDIT_QUANTITY, label: 'Modifier la quantité' }]
      : []),
    ...(onRemove ? [{ name: REMOVE, label: 'Retirer de la liste' }] : []),
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
              key={`quantity-${inCart}`}
              style={[
                styles.quantity,
                { color: colors.onSurfaceVariant },
                inCart && styles.ticked,
              ]}
            >
              {formatQuantity(quantity)}
            </Text>
          )}
        </View>
      </TouchableRipple>
      {actions.length > 0 && (
        // Reached by screen readers as the checkbox's actions.
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={styles.actions}
        >
          {onEditQuantity && (
            <IconButton
              icon="edit"
              accessibilityLabel="Modifier la quantité"
              onPress={onEditQuantity}
              style={styles.action}
            />
          )}
          {onRemove && (
            <IconButton
              icon="close"
              accessibilityLabel="Retirer de la liste"
              onPress={onRemove}
              style={styles.action}
            />
          )}
        </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  name: { flexShrink: 1 },
  quantity: typeOverrides.quantity,
  ticked: { textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row' },
  // The mockups' 48 dp icon buttons (FR-034).
  action: { width: 48, height: 48, margin: 0 },
});
