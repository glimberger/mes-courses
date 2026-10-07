import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, List, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ArticleId } from '../../../domain/article';
import type { CurrentListView } from '../../../domain/current-list-view';
import type { Quantity } from '../../../domain/quantity';
import { focusOn } from '../accessibility/focus';
import { AppbarIconAction } from '../components/AppbarIconAction';
import { ListItemRow } from '../components/ListItemRow';
import { SCREEN_FAB_CLEARANCE, ScreenFab } from '../components/ScreenFab';
import { ScreenStateView } from '../components/ScreenStateView';
import type { RootStackParamList } from '../routes';
import { useAppStore } from '../state/use-app-store';
import { FinishShoppingDialog } from './FinishShoppingDialog';

/** "3 articles restants", "1 article restant", or "Tout est dans le caddie" (FR-006). */
const remainingText = (count: number) => {
  if (count === 0) return 'Tout est dans le caddie';
  return count === 1 ? '1 article restant' : `${count} articles restants`;
};

type RowProps = {
  articleId: ArticleId;
  name: string;
  inCart: boolean;
  quantity: Quantity | null;
  toggleItem: (articleId: ArticleId) => Promise<void>;
};

/** A row whose tap callback stays the same between renders, so the row is not drawn again. */
const CurrentListRow = memo(function CurrentListRow({
  articleId,
  toggleItem,
  ...item
}: RowProps) {
  const onToggle = useCallback(() => {
    void toggleItem(articleId);
  }, [articleId, toggleItem]);
  return <ListItemRow {...item} onToggle={onToggle} />;
});

/**
 * The current list (User Story 1): its items by category, ticked with a tap, the remaining count,
 * and "Terminer les courses" once an item is in the cart.
 */
export const CurrentListScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentList = useAppStore((state) => state.currentList);
  const loadCurrentList = useAppStore((state) => state.loadCurrentList);
  const toggleItem = useAppStore((state) => state.toggleItem);
  const finishShopping = useAppStore((state) => state.finishShopping);
  const [finishing, setFinishing] = useState(false);
  const titleRef = useRef<View>(null);
  const finishActionRef = useRef<View>(null);

  useEffect(() => {
    void loadCurrentList();
  }, [loadCurrentList]);

  const list =
    currentList.status === 'success'
      ? currentList.data.list
      : currentList.status === 'empty'
        ? currentList.detail.list
        : null;
  const view = currentList.status === 'success' ? currentList.data : null;

  const cancelFinish = () => {
    setFinishing(false);
    focusOn(finishActionRef);
  };
  const confirmFinish = async () => {
    setFinishing(false);
    const outcome = await finishShopping();
    // Once finished, "Terminer les courses" is gone: focus goes to the title (FR-037).
    focusOn(outcome.ok ? titleRef : finishActionRef);
  };
  const addArticles = () => navigation.navigate('AddArticles');

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        <Appbar.Content
          title={
            <View>
              {/* The list name as a header, and the target of a focus move. */}
              <View ref={titleRef} accessible accessibilityRole="header">
                <Text variant="titleLarge" numberOfLines={1}>
                  {list?.name ?? ''}
                </Text>
              </View>
              {view && (
                // Not announced when it changes (FR-038).
                <Text variant="bodyMedium" accessibilityLiveRegion="none">
                  {remainingText(view.remainingCount)}
                </Text>
              )}
            </View>
          }
        />
        {view?.hasItemsInCart && (
          <AppbarIconAction
            ref={finishActionRef}
            icon="cart-check"
            accessibilityLabel="Terminer les courses"
            onPress={() => setFinishing(true)}
          />
        )}
        <AppbarIconAction
          icon="format-list-bulleted"
          accessibilityLabel="Mes listes"
          onPress={() => navigation.navigate('Lists')}
        />
      </Appbar.Header>
      <ScreenStateView
        state={currentList}
        errorMessage="Impossible de charger la liste."
        onRetry={() => void loadCurrentList()}
        empty={() => ({
          message: 'Votre liste est vide',
          action: { label: 'Ajouter des articles', onPress: addArticles },
        })}
        renderSuccess={(data) => (
          <CurrentListSections view={data} toggleItem={toggleItem} />
        )}
      />
      {view && <ScreenFab icon="plus" label="Ajouter" onPress={addArticles} />}
      <FinishShoppingDialog
        visible={finishing}
        onCancel={cancelFinish}
        onConfirm={() => void confirmFinish()}
      />
    </View>
  );
};

/** A row's identity: its article, wherever it moves. */
const rowId = (item: { articleId: ArticleId }) => item.articleId;

const CurrentListSections = ({
  view,
  toggleItem,
}: {
  view: CurrentListView;
  toggleItem: (articleId: ArticleId) => Promise<void>;
}) => (
  <SectionList
    sections={view.sections.map((section) => ({
      title: section.category.name,
      data: section.items,
    }))}
    // Rows identified by article id keep their native view, and screen reader focus, when they
    // move (FR-037, research R11).
    keyExtractor={rowId}
    renderSectionHeader={({ section }) => (
      <List.Subheader accessibilityRole="header">
        {section.title}
      </List.Subheader>
    )}
    renderItem={({ item }) => (
      <CurrentListRow {...item} toggleItem={toggleItem} />
    )}
    stickySectionHeadersEnabled={false}
    contentContainerStyle={styles.content}
  />
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: SCREEN_FAB_CLEARANCE },
});
