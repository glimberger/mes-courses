import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type HostInstance } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import type { ListSummary } from '../../../domain/list-summary';
import { focusOn } from '../accessibility/focus';
import { ListSummaryRow } from '../components/ListSummaryRow';
import { ScreenFab, SCREEN_FAB_CLEARANCE } from '../components/ScreenFab';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenStateView } from '../components/ScreenStateView';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { spacing } from '../theme/spacing';
import { useAppStore } from '../state/use-app-store';
import { CreateListDialog } from './CreateListDialog';

/** A row whose callback stays the same between renders. */
const ListRow = memo(function ListRow({
  list,
  onChoose,
}: {
  list: ListSummary;
  onChoose: (list: ListSummary) => void;
}) {
  const onPress = useCallback(() => onChoose(list), [list, onChoose]);
  return (
    <ListSummaryRow
      name={list.name}
      itemCount={list.itemCount}
      isCurrent={list.isCurrent}
      onPress={onPress}
    />
  );
});

/** A row's identity: its list. */
const rowId = (list: ListSummary) => list.id;

/**
 * The lists (User Story 3), by name with their item counts and the current one marked. A tap
 * makes a list current and goes back to it (US3-3); the FAB creates a list (US3-2).
 */
export const ListsScreen = () => {
  const navigation = useNavigation();
  const lists = useAppStore((state) => state.lists);
  const loadLists = useAppStore((state) => state.loadLists);
  const setCurrentList = useAppStore((state) => state.setCurrentList);
  const [creating, setCreating] = useState(false);
  const fabRef = useRef<HostInstance>(null);

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
      // Courses is another tab: its stack shows the list again (the reset is T021).
      navigation.navigate('CoursesTab', { screen: 'CurrentList' });
      // The screen stays mounted behind the Courses tab: the next visit can choose again.
      choosing.current = false;
    },
    [navigation, setCurrentList],
  );
  const onChoose = useCallback(
    (list: ListSummary) => void choose(list),
    [choose],
  );

  const closeDialog = () => {
    setCreating(false);
    focusOn(fabRef);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        variant="center"
        title="Mes listes"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
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
              <ListRow list={item} onChoose={onChoose} />
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
