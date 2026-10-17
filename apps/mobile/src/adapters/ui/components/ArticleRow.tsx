import { memo, useState, type Ref } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type HostInstance,
} from 'react-native';
import {
  Icon,
  Menu,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';
import { AppbarIconAction } from './AppbarIconAction';
import { Card } from './Card';
import { Chip } from './Chip';
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

// The mockups' article row (`.row`, `.row.checked`): a 64 dp card row, and a 36 dp add circle.
const ROW_MIN_HEIGHT = 64;
const ADD_CIRCLE = 36;
const ADD_ICON = 24;

/**
 * One article of the catalog, opening the quantity dialog when tapped. An article already on the
 * list shows the "Déjà dans la liste" chip, which its label reads too; an article not on it shows
 * a brand add circle. A trailing button opens a menu with "Modifier" and "Supprimer", also
 * reached by screen readers as accessibility actions of the row. The name wraps (FR-033) and the
 * row is at least 48 dp high (FR-034).
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
  const { colors } = useTheme() as AppTheme;
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
        <Text
          variant="titleMedium"
          style={[styles.name, { color: colors.onSurface }]}
        >
          {name}
        </Text>
        {onList ? (
          // Read with the row's label.
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={styles.chip}
          >
            <Chip tone="tertiary" icon="check">
              Déjà dans la liste
            </Chip>
          </View>
        ) : (
          // Decorative: the row's label already names the article.
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[styles.addCircle, { backgroundColor: colors.brandSoft }]}
          >
            <Icon source="add" size={ADD_ICON} color={colors.onBrandSoft} />
          </View>
        )}
      </View>
    </TouchableRipple>
  );

  if (actions.length === 0) {
    return <Card style={styles.card}>{row}</Card>;
  }

  return (
    <Card style={styles.card}>
      {row}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        overlayAccessibilityLabel="Fermer le menu"
        anchorPosition="bottom"
        anchor={
          <AppbarIconAction
            icon="more_vert"
            accessibilityLabel={`Plus d'actions pour « ${name} »`}
            onPress={() => setMenuVisible(true)}
          />
        }
      >
        {onEdit && <Menu.Item title="Modifier" onPress={choose(onEdit)} />}
        {onDelete && <Menu.Item title="Supprimer" onPress={choose(onDelete)} />}
      </Menu>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  row: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: shape.lg,
  },
  content: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingStart: 14,
    paddingEnd: 6,
  },
  name: { flex: 1 },
  // The row takes the tap.
  chip: { pointerEvents: 'none' },
  addCircle: {
    width: ADD_CIRCLE,
    height: ADD_CIRCLE,
    borderRadius: ADD_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
