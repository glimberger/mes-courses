import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Appbar, List, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ArticleId } from '../../../domain/article';
import type { CurrentListView } from '../../../domain/current-list-view';
import { focusOn } from '../accessibility/focus';
import { AppbarIconAction } from '../components/AppbarIconAction';
import { ListItemRow } from '../components/ListItemRow';
import { SCREEN_FAB_CLEARANCE, ScreenFab } from '../components/ScreenFab';
import { ScreenStateView } from '../components/ScreenStateView';
import type { RootStackParamList } from '../routes';
import { shownList } from '../state/current-list-actions';
import { useAppStore } from '../state/use-app-store';
import { FinishShoppingDialog } from './FinishShoppingDialog';
import { QuantityDialog, type QuantityRequest } from './QuantityDialog';

/** "3 articles restants", "1 article restant", or "Tout est dans le caddie" (FR-006). */
const remainingText = (count: number) => {
  if (count === 0) return 'Tout est dans le caddie';
  return count === 1 ? '1 article restant' : `${count} articles restants`;
};

type Item = CurrentListView['sections'][number]['items'][number];

/** What a row can ask the screen to do with its item. */
type RowHandlers = {
  toggleItem: (articleId: ArticleId) => Promise<unknown>;
  editQuantity: (articleId: ArticleId) => void;
  remove: (articleId: ArticleId) => void;
  /** The rows drawn, by article, for the focus moves (FR-037). */
  rowRefs: Map<ArticleId, View>;
};

/**
 * A row drawn again only when its item changes: it takes the item's fields, not the item, which a
 * reload builds anew, and its callbacks stay the same between renders.
 */
const CurrentListRow = memo(function CurrentListRow({
  articleId,
  name,
  quantity,
  inCart,
  handlers: { toggleItem, editQuantity, remove, rowRefs },
}: Item & { handlers: RowHandlers }) {
  const onToggle = useCallback(() => {
    void toggleItem(articleId);
  }, [articleId, toggleItem]);
  const onEditQuantity = useCallback(
    () => editQuantity(articleId),
    [articleId, editQuantity],
  );
  const onRemove = useCallback(() => remove(articleId), [articleId, remove]);
  const ref = useCallback(
    (node: View | null) => {
      if (node) rowRefs.set(articleId, node);
      else rowRefs.delete(articleId);
    },
    [articleId, rowRefs],
  );
  return (
    <ListItemRow
      ref={ref}
      name={name}
      quantity={quantity}
      inCart={inCart}
      onToggle={onToggle}
      onEditQuantity={onEditQuantity}
      onRemove={onRemove}
    />
  );
});

/** The row focus goes to once the item is removed: the next one, or the one before (FR-037). */
const neighbourOf = (
  view: CurrentListView,
  articleId: ArticleId,
): ArticleId | null => {
  const rows = view.sections.flatMap((section) =>
    section.items.map((item) => item.articleId),
  );
  const at = rows.indexOf(articleId);
  return rows[at + 1] ?? rows[at - 1] ?? null;
};

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
  const removeItem = useAppStore((state) => state.removeItem);
  const [finishing, setFinishing] = useState(false);
  const [request, setRequest] = useState<QuantityRequest | null>(null);
  const titleRef = useRef<View>(null);
  const finishActionRef = useRef<View>(null);
  const emptyMessageRef = useRef<View>(null);
  const [rowRefs] = useState(() => new Map<ArticleId, View>());
  const editing = useRef<ArticleId | null>(null);
  // The view as last drawn, read by `remove` and `editQuantity`, which stay the same as the view
  // changes.
  const viewRef = useRef<CurrentListView | null>(null);

  useEffect(() => {
    void loadCurrentList();
  }, [loadCurrentList]);

  const list = shownList(currentList);
  const view = currentList.status === 'success' ? currentList.data : null;
  useEffect(() => {
    viewRef.current = view;
  });

  /** Focus on the row of the item, looked up once the screen has settled (FR-037). */
  const focusOnRow = useCallback(
    (articleId: ArticleId) =>
      focusOn({
        get current() {
          return rowRefs.get(articleId) ?? null;
        },
      }),
    [rowRefs],
  );

  const editQuantity = useCallback((articleId: ArticleId) => {
    const item = viewRef.current?.sections
      .flatMap((section) => section.items)
      .find((shown) => shown.articleId === articleId);
    if (!item) return;
    editing.current = articleId;
    setRequest({
      mode: 'edit',
      article: { id: item.articleId, name: item.name },
      quantity: item.quantity,
    });
  }, []);

  const closeDialog = () => {
    setRequest(null);
    if (editing.current !== null) focusOnRow(editing.current);
  };

  const remove = useCallback(
    async (articleId: ArticleId) => {
      const shown = viewRef.current;
      const neighbour = shown && neighbourOf(shown, articleId);
      const outcome = await removeItem(articleId);
      if (!outcome.ok) return;
      if (neighbour === null) focusOn(emptyMessageRef);
      else focusOnRow(neighbour);
    },
    [removeItem, focusOnRow],
  );

  // Every callback is stable, so the rows are not drawn again for them.
  const handlers = useMemo<RowHandlers>(
    () => ({
      toggleItem,
      editQuantity,
      remove: (articleId) => void remove(articleId),
      rowRefs,
    }),
    [toggleItem, editQuantity, remove, rowRefs],
  );

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
          messageRef: emptyMessageRef,
        })}
        renderSuccess={(data) => (
          <CurrentListSections view={data} handlers={handlers} />
        )}
      />
      {view && <ScreenFab icon="plus" label="Ajouter" onPress={addArticles} />}
      <FinishShoppingDialog
        visible={finishing}
        onCancel={cancelFinish}
        onConfirm={() => void confirmFinish()}
      />
      <QuantityDialog request={request} onClose={closeDialog} />
    </View>
  );
};

/** A row's identity: its article, wherever it moves. */
const rowId = (item: { articleId: ArticleId }) => item.articleId;

const CurrentListSections = ({
  view,
  handlers,
}: {
  view: CurrentListView;
  handlers: RowHandlers;
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
    renderItem={({ item }) => <CurrentListRow {...item} handlers={handlers} />}
    stickySectionHeadersEnabled={false}
    contentContainerStyle={styles.content}
  />
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: SCREEN_FAB_CLEARANCE },
});
