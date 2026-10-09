import { memo, useState, type Ref } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type HostInstance,
} from 'react-native';
import { Chip, Menu, Text, TouchableRipple } from 'react-native-paper';

import { spacing } from '../theme/spacing';
import { AppbarIconAction } from './AppbarIconAction';
import { paperRef } from './paper-ref';

export type ArticleRowProps = {
  name: string;
  /** Already on the current list (FR-011, US2-8). */
  onList: boolean;
  onPress: () => void;
  /** Shows "Modifier" in the row menu and as an accessibility action (002 FR-001). */
  onEdit?: () => void;
  /** Shows "Supprimer" in the row menu and as an accessibility action (002 FR-004). */
  onDelete?: () => void;
  /** The row screen readers focus, for a focus move (FR-037). */
  ref?: Ref<HostInstance>;
};

const EDIT = 'edit';
const DELETE = 'delete';

/**
 * One article of the catalog, opening the quantity dialog when tapped. An article already on the
 * list shows the "Déjà dans la liste" chip, which its label reads too. A trailing button opens a
 * menu with "Modifier" and "Supprimer", also reached by screen readers as accessibility actions
 * of the row. The name wraps (FR-033) and the row is at least 48 dp high (FR-034).
 */
export const ArticleRow = memo(function ArticleRow({
  name,
  onList,
  onPress,
  onEdit,
  onDelete,
  ref,
}: ArticleRowProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const actions = [
    ...(onEdit ? [{ name: EDIT, label: 'Modifier' }] : []),
    ...(onDelete ? [{ name: DELETE, label: 'Supprimer' }] : []),
  ];
  const onAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === EDIT) onEdit?.();
    if (nativeEvent.actionName === DELETE) onDelete?.();
  };
  const choose = (action: (() => void) | undefined) => () => {
    setMenuVisible(false);
    action?.();
  };

  const row = (
    <TouchableRipple
      ref={paperRef(ref)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={onList ? `${name}, déjà dans la liste` : name}
      accessibilityActions={actions.length > 0 ? actions : undefined}
      onAccessibilityAction={actions.length > 0 ? onAction : undefined}
      style={styles.row}
    >
      <View style={styles.content}>
        <Text variant="bodyLarge" style={styles.name}>
          {name}
        </Text>
        {onList && (
          // Read with the row's label.
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={styles.chip}
          >
            <Chip compact icon="check">
              Déjà dans la liste
            </Chip>
          </View>
        )}
      </View>
    </TouchableRipple>
  );
  if (actions.length === 0) return row;

  return (
    <View style={styles.withMenu}>
      {row}
      <View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          overlayAccessibilityLabel="Fermer le menu"
          anchorPosition="bottom"
          anchor={
            <AppbarIconAction
              icon="dots-vertical"
              accessibilityLabel={`Plus d'actions pour « ${name} »`}
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          {onEdit && <Menu.Item title="Modifier" onPress={choose(onEdit)} />}
          {onDelete && (
            <Menu.Item title="Supprimer" onPress={choose(onDelete)} />
          )}
        </Menu>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flex: 1, minHeight: 48, justifyContent: 'center' },
  withMenu: { flexDirection: 'row', alignItems: 'center' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  name: { flex: 1 },
  // The row takes the tap.
  chip: { pointerEvents: 'none' },
});
