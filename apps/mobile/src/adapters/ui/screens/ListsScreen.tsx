import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type HostInstance } from 'react-native';
import { Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

import type { ListSummary } from '../../../domain/list-summary';
import { focusOn } from '../accessibility/focus';
import { ListSummaryRow } from '../components/ListSummaryRow';
import { SCREEN_FAB_CLEARANCE, ScreenFab } from '../components/ScreenFab';
import { BackAction } from '../components/BackAction';
import { ScreenStateView } from '../components/ScreenStateView';
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
      if (navigation.canGoBack()) navigation.goBack();
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
      <Appbar.Header>
        {navigation.canGoBack() && (
          <BackAction onPress={() => navigation.goBack()} />
        )}
        <Appbar.Content title="Mes listes" />
      </Appbar.Header>
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
        icon="plus"
        label="Nouvelle liste"
        onPress={() => setCreating(true)}
      />
      <CreateListDialog visible={creating} onClose={closeDialog} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: SCREEN_FAB_CLEARANCE },
});
