import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, StyleSheet, View, type HostInstance } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ArticleId } from '../../../domain/article';
import type { CatalogView } from '../../../domain/catalog-view';
import { focusOn } from '../accessibility/focus';
import { CatalogArticleRow } from '../components/CatalogArticleRow';
import { CategoryHeader } from '../components/CategoryHeader';
import { EmptyState } from '../components/EmptyState';
import { ScreenFab, SCREEN_FAB_CLEARANCE } from '../components/ScreenFab';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenStateView } from '../components/ScreenStateView';
import { SearchField } from '../components/SearchField';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { hasScreenBelow } from '../navigation-history';
import type { RootStackParamList } from '../routes';
import { useAppStoreApi } from '../state/app-store-provider';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { DeleteArticleDialog } from './DeleteArticleDialog';
import { EditArticleDialog, type EditedArticle } from './EditArticleDialog';

/** A row: the article and the category of its section, which the edit dialog starts from. */
type CatalogRow = EditedArticle;

/** The articles with their category, empty categories left out (AC1). */
const withArticles = (view: CatalogView) =>
  view.sections.filter((section) => section.articles.length > 0);

const rowId = (row: CatalogRow) => row.id;

type RowRefs = Map<ArticleId, HostInstance>;

type CatalogRowProps = {
  article: CatalogRow;
  /** The usage count of the article, 0 when it is on no list. */
  count: number;
  open: (article: CatalogRow, dialog: 'edit' | 'delete') => void;
  rowRefs: RowRefs;
  /** Shows the ⋮ menu open, for stories. */
  menuInitiallyOpen: boolean;
};

/** A row whose callbacks stay the same between renders, so typing does not draw it again. */
const CatalogListRow = memo(function CatalogListRow({
  article,
  count,
  open,
  rowRefs,
  menuInitiallyOpen,
}: CatalogRowProps) {
  const onEdit = useCallback(() => open(article, 'edit'), [article, open]);
  const onDelete = useCallback(() => open(article, 'delete'), [article, open]);
  const ref = useCallback(
    (node: HostInstance | null) => {
      if (node) rowRefs.set(article.id, node);
      else rowRefs.delete(article.id);
    },
    [article.id, rowRefs],
  );
  return (
    <CatalogArticleRow
      ref={ref}
      name={article.name}
      count={count}
      onEdit={onEdit}
      onDelete={onDelete}
      menuInitiallyOpen={menuInitiallyOpen}
    />
  );
});

const renderSectionHeader = ({ section }: { section: { title: string } }) => (
  <CategoryHeader title={section.title} />
);

export type CatalogScreenProps = {
  /** The search text to start from, for stories. */
  initialQuery?: string;
  /** The name of the article whose ⋮ menu starts open, for stories. */
  menuInitiallyOpenFor?: string;
};

/**
 * The Articles tab's root: the whole catalog by category, searched as the user types, each row
 * with the number of lists holding the article (spec 011, Catalog).
 */
export const CatalogScreen = ({
  initialQuery = '',
  menuInitiallyOpenFor,
}: CatalogScreenProps = {}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const catalog = useAppStore((state) => state.catalog.view);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const searchCatalog = useAppStore((state) => state.searchCatalog);
  const usageCounts = useAppStore((state) => state.usageCounts);
  const loadArticleUsageCounts = useAppStore(
    (state) => state.loadArticleUsageCounts,
  );

  // The store holds one query, shared with the add screen: this screen puts its own back
  // whenever it is shown. Its own text is kept while the tab is away (a tab root stays mounted),
  // and the store's query is dropped only when the screen unmounts.
  const [query, setQuery] = useState(initialQuery);
  const [editing, setEditing] = useState<EditedArticle | null>(null);
  const [deleting, setDeleting] = useState<EditedArticle | null>(null);
  const titleRef = useRef<HostInstance>(null);
  const store = useAppStoreApi();
  const [rowRefs] = useState<RowRefs>(() => new Map());
  const opener = useRef<ArticleId | null>(null);
  useEffect(() => {
    void loadCatalog();
    void loadArticleUsageCounts();
    return () => searchCatalog('');
  }, [loadCatalog, loadArticleUsageCounts, searchCatalog]);
  useFocusEffect(
    useCallback(() => {
      searchCatalog(query);
    }, [query, searchCatalog]),
  );

  // A failed batch read leaves the rows without badges rather than hiding the catalog.
  const counts: ReadonlyMap<ArticleId, number> = useMemo(
    () => (usageCounts.status === 'success' ? usageCounts.data : new Map()),
    [usageCounts],
  );

  /**
   * Opens a dialog once the number of lists holding the article is known: the dialogs tell it,
   * and a wrong "no list" would hide what the change reaches. The counts are read again when the
   * last read failed; if that fails too, the dialog stays closed and the user is told.
   */
  const open = useCallback(
    async (article: CatalogRow, dialog: 'edit' | 'delete') => {
      if (store.getState().usageCounts.status !== 'success') {
        await loadArticleUsageCounts();
      }
      const { usageCounts: fresh } = store.getState();
      if (fresh.status !== 'success') {
        store.setState({ notice: { type: 'writeFailed' } });
        return;
      }
      opener.current = article.id;
      (dialog === 'edit' ? setEditing : setDeleting)(article);
    },
    [store, loadArticleUsageCounts],
  );

  const countOf = (article: CatalogRow | null) =>
    article === null ? 0 : (counts.get(article.id) ?? 0);

  // Screen reader focus goes back to the row that opened the dialog, looked up once the dialog
  // is gone; a deleted article has no row left, so the title takes it (FR-037).
  const focusRow = () => {
    const id = opener.current;
    focusOn({
      get current() {
        return (id === null ? null : rowRefs.get(id)) ?? titleRef.current;
      },
    });
  };

  const sections = useMemo(
    () =>
      catalog.status === 'success'
        ? withArticles(catalog.data).map((section) => ({
            title: section.category.name,
            data: section.articles.map(({ id, name }) => ({
              id,
              name,
              categoryId: section.category.id,
            })),
          }))
        : [],
    [catalog],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Articles"
        titleVariant="titleLarge"
        titleRef={titleRef}
        onBack={
          hasScreenBelow(navigation) ? () => navigation.goBack() : undefined
        }
      />
      <SyncStatusBar />
      <SearchField
        placeholder="Rechercher un article"
        value={query}
        onChangeText={setQuery}
      />
      <ScreenStateView
        state={catalog}
        errorMessage="Impossible de charger les articles."
        onRetry={() => {
          void loadCatalog();
          void loadArticleUsageCounts();
        }}
        empty={(detail) => ({
          message: `Aucun article ne correspond à « ${detail.query} »`,
        })}
        renderSuccess={() => {
          if (sections.length === 0) {
            return <EmptyState message="Aucun article" />;
          }
          return (
            <SectionList<CatalogRow, { title: string }>
              // Named, so the end-to-end journeys can scroll it.
              accessibilityLabel="Articles du catalogue"
              sections={sections}
              keyExtractor={rowId}
              renderSectionHeader={renderSectionHeader}
              renderItem={({ item }) => (
                <View style={styles.item}>
                  <CatalogListRow
                    article={item}
                    count={counts.get(item.id) ?? 0}
                    open={open}
                    rowRefs={rowRefs}
                    menuInitiallyOpen={item.name === menuInitiallyOpenFor}
                  />
                </View>
              )}
              stickySectionHeadersEnabled={false}
              initialNumToRender={20}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
            />
          );
        }}
      />
      <EditArticleDialog
        article={editing}
        count={countOf(editing)}
        onClose={() => {
          setEditing(null);
          focusRow();
        }}
      />
      <DeleteArticleDialog
        article={deleting}
        count={countOf(deleting)}
        onClose={() => {
          setDeleting(null);
          focusRow();
        }}
      />
      <ScreenFab
        icon="add"
        label="Nouvel article"
        onPress={() =>
          navigation.navigate('CreateArticle', { addToList: false })
        }
      />
    </View>
  );
};

// The mockups' rows: cards 16 dp from the sides and 10 dp apart.
const CARD_GAP = 10;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: SCREEN_FAB_CLEARANCE },
  item: { paddingHorizontal: spacing.md, paddingBottom: CARD_GAP },
});
