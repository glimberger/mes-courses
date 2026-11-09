import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type HostInstance } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import type { ListId } from '../../../domain/shopping-list';
import type { ListSummary } from '../../../domain/list-summary';
import { focusOn } from '../accessibility/focus';
import { hasScreenBelow } from '../navigation-history';
import { ListSummaryRow } from '../components/ListSummaryRow';
import { ScreenFab, SCREEN_FAB_CLEARANCE } from '../components/ScreenFab';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenStateView } from '../components/ScreenStateView';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { spacing } from '../theme/spacing';
import { useAppStore } from '../state/use-app-store';
import { CreateListDialog } from './CreateListDialog';
import { DeleteListDialog, type DeletedListTarget } from './DeleteListDialog';
import { EditListDialog, type EditedList } from './EditListDialog';

type RowRefs = Map<ListId, HostInstance>;

type ListRowProps = {
  list: ListSummary;
  onChoose: (list: ListSummary) => void;
  open: (list: ListSummary, dialog: 'edit' | 'delete') => void;
  menuRefs: RowRefs;
  /** Shows the ⋮ menu open, for stories. */
  menuInitiallyOpen: boolean;
};

/** A row whose callbacks stay the same between renders. */
const ListRow = memo(function ListRow({
  list,
  onChoose,
  open,
  menuRefs,
  menuInitiallyOpen,
}: ListRowProps) {
  const onPress = useCallback(() => onChoose(list), [list, onChoose]);
  const onEdit = useCallback(() => open(list, 'edit'), [list, open]);
  const onDelete = useCallback(() => open(list, 'delete'), [list, open]);
  const menuButtonRef = useCallback(
    (node: HostInstance | null) => {
      if (node) menuRefs.set(list.id, node);
      else menuRefs.delete(list.id);
    },
    [list.id, menuRefs],
  );
  return (
    <ListSummaryRow
      name={list.name}
      itemCount={list.itemCount}
      isCurrent={list.isCurrent}
      onPress={onPress}
      onEdit={onEdit}
      onDelete={onDelete}
      menuButtonRef={menuButtonRef}
      menuInitiallyOpen={menuInitiallyOpen}
    />
  );
});

/** A row's identity: its list. */
const rowId = (list: ListSummary) => list.id;

/**
 * The lists (User Story 3), by name with their item counts and the current one marked. A tap
 * makes a list current and opens the Courses tab on it (US4); the FAB creates a list (US3-2); the
 * ⋮ menu of a row renames or deletes it (spec 012).
 */
export type ListsScreenProps = {
  /** The name of the list whose ⋮ menu starts open, for stories. */
  menuInitiallyOpenFor?: string;
};

export const ListsScreen = ({
  menuInitiallyOpenFor,
}: ListsScreenProps = {}) => {
  const navigation = useNavigation();
  const lists = useAppStore((state) => state.lists);
  const loadLists = useAppStore((state) => state.loadLists);
  const setCurrentList = useAppStore((state) => state.setCurrentList);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditedList | null>(null);
  const [deleting, setDeleting] = useState<DeletedListTarget | null>(null);
  const fabRef = useRef<HostInstance>(null);
  const [menuRefs] = useState<RowRefs>(() => new Map());
  const opener = useRef<ListId | null>(null);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  // Set from the first tap until its choice is settled: a second tap would queue another
  // change and go back twice.
  const choosing = useRef(false);
  const choose = useCallback(
    async (list: ListSummary) => {
      if (choosing.current) return;
      choosing.current = true;
      // The current list stays as it is: nothing to save, and the undo offer stays (FR-025).
      if (!list.isCurrent) {
        const outcome = await setCurrentList(list.id);
        // A failed save stays here: the snackbar says so.
        if (!outcome.ok) {
          choosing.current = false;
          return;
        }
      }
      // Courses is another tab: its stack returns to the list (`pop`), so an open add screen
      // never targets another list.
      navigation.navigate('CoursesTab', { screen: 'CurrentList', pop: true });
      // The screen stays mounted behind the Courses tab: the next visit can choose again.
      choosing.current = false;
    },
    [navigation, setCurrentList],
  );
  const onChoose = useCallback(
    (list: ListSummary) => void choose(list),
    [choose],
  );

  const open = useCallback((list: ListSummary, dialog: 'edit' | 'delete') => {
    opener.current = list.id;
    const target = { id: list.id, name: list.name };
    (dialog === 'edit' ? setEditing : setDeleting)(target);
  }, []);

  const closeDialog = () => {
    setCreating(false);
    focusOn(fabRef);
  };

  // Screen reader focus goes back to the ⋮ button of the row that opened the dialog, looked up
  // once the dialog is gone; a deleted list has no row left, so the FAB takes it (FR-037).
  const focusMenuButton = () => {
    const id = opener.current;
    focusOn({
      get current() {
        return (id === null ? null : menuRefs.get(id)) ?? fabRef.current;
      },
    });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        variant="center"
        title="Mes listes"
        onBack={
          hasScreenBelow(navigation) ? () => navigation.goBack() : undefined
        }
      />
      <SyncStatusBar />
      <ScreenStateView
        state={lists}
        errorMessage="Impossible de charger vos listes."
        onRetry={() => void loadLists()}
        renderSuccess={(data) => (
          <FlatList
            data={data}
            keyExtractor={rowId}
            renderItem={({ item }) => (
              <ListRow
                list={item}
                onChoose={onChoose}
                open={open}
                menuRefs={menuRefs}
                menuInitiallyOpen={item.name === menuInitiallyOpenFor}
              />
            )}
            contentContainerStyle={styles.list}
          />
        )}
      />
      <ScreenFab
        ref={fabRef}
        icon="add"
        label="Nouvelle liste"
        onPress={() => setCreating(true)}
      />
      <CreateListDialog visible={creating} onClose={closeDialog} />
      <EditListDialog
        list={editing}
        onClose={() => {
          setEditing(null);
          focusMenuButton();
        }}
      />
      <DeleteListDialog
        list={deleting}
        onClose={() => {
          setDeleting(null);
          focusMenuButton();
        }}
      />
    </View>
  );
};

// The mockup's lists: the first card sits 14 dp under the header, the cards 10 dp apart.
const FIRST_CARD_TOP = 14;
const CARD_GAP = 10;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: {
    paddingTop: FIRST_CARD_TOP,
    paddingHorizontal: spacing.md,
    paddingBottom: SCREEN_FAB_CLEARANCE,
    gap: CARD_GAP,
  },
});
