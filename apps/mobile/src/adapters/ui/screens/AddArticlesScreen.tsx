import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { SectionList, StyleSheet, View, type HostInstance } from 'react-native';
import { Appbar, Button, List, Searchbar, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ArticleId } from '../../../domain/article';
import type { CatalogView } from '../../../domain/catalog-view';
import type { CategoryId } from '../../../domain/category';
import { cleanName } from '../../../domain/name';
import { focusOn } from '../accessibility/focus';
import { AppbarIconAction } from '../components/AppbarIconAction';
import { ArticleRow } from '../components/ArticleRow';
import { ScreenStateView } from '../components/ScreenStateView';
import type { RootStackParamList } from '../routes';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { QuantityDialog, type QuantityRequest } from './QuantityDialog';

type CatalogArticle = CatalogView['sections'][number]['articles'][number];

/** Stands for the one row of a category with no article (US2-15). */
type EmptyCategory = { empty: true; categoryId: CategoryId };

type Row = CatalogArticle | EmptyCategory;

const isEmptyCategory = (row: Row): row is EmptyCategory => 'empty' in row;

/** The rows drawn, by article, so focus can go back to the one that opened the dialog. */
type RowRefs = Map<ArticleId, HostInstance>;

type CatalogRowProps = {
  article: CatalogArticle;
  open: (article: CatalogArticle) => void;
  rowRefs: RowRefs;
};

/** A row whose callbacks stay the same between renders, so typing does not draw it again. */
const CatalogRow = memo(function CatalogRow({
  article,
  open,
  rowRefs,
}: CatalogRowProps) {
  const onPress = useCallback(() => open(article), [article, open]);
  const ref = useCallback(
    (node: HostInstance | null) => {
      if (node) rowRefs.set(article.id, node);
      else rowRefs.delete(article.id);
    },
    [article.id, rowRefs],
  );
  return (
    <ArticleRow
      ref={ref}
      name={article.name}
      onList={article.onList}
      onPress={onPress}
    />
  );
});

/**
 * The catalog, to add articles to the current list (User Story 2): every category, searched as
 * the user types without reading storage again (SC-011, R11a), and the quantity dialog. The
 * screen stays open after adding, so several articles can be added in a row.
 */
export const AddArticlesScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const catalog = useAppStore((state) => state.catalog.view);
  const query = useAppStore((state) => state.catalog.query);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const searchCatalog = useAppStore((state) => state.searchCatalog);
  const [request, setRequest] = useState<QuantityRequest | null>(null);
  const [rowRefs] = useState<RowRefs>(() => new Map());
  const opener = useRef<ArticleId | null>(null);

  // Leaving clears the search, so the screen opens on the whole catalog the next time.
  useEffect(() => {
    void loadCatalog();
    return () => searchCatalog('');
  }, [searchCatalog, loadCatalog]);

  const open = useCallback((article: CatalogArticle) => {
    opener.current = article.id;
    const { id, name } = article;
    setRequest(
      article.onList
        ? {
            mode: 'alreadyOnList',
            article: { id, name },
            quantity: article.quantity,
          }
        : { mode: 'add', article: { id, name } },
    );
  }, []);

  const closeDialog = () => {
    setRequest(null);
    // Back to the row that opened the dialog, looked up once the dialog is gone (FR-037).
    const id = opener.current;
    focusOn({
      get current() {
        return id === null ? null : (rowRefs.get(id) ?? null);
      },
    });
  };

  const createArticle = (params: RootStackParamList['CreateArticle']) =>
    navigation.navigate('CreateArticle', params);

  /** "Nouvel article", named after the search if there is one (FR-008, FR-022). */
  const newArticle = () => {
    const name = cleanName(query);
    createArticle(name === '' ? undefined : { name });
  };

  return (
    <View style={styles.screen}>
      <Appbar.Header>
        {navigation.canGoBack() && (
          <Appbar.BackAction
            accessibilityLabel="Retour"
            onPress={() => navigation.goBack()}
          />
        )}
        <Appbar.Content title="Ajouter des articles" />
        <AppbarIconAction
          icon="plus"
          accessibilityLabel="Nouvel article"
          onPress={newArticle}
        />
      </Appbar.Header>
      <Searchbar
        placeholder="Rechercher un article"
        accessibilityLabel="Rechercher un article"
        value={query}
        onChangeText={searchCatalog}
        style={styles.search}
      />
      <ScreenStateView
        state={catalog}
        errorMessage="Impossible de charger les articles."
        onRetry={() => void loadCatalog()}
        empty={(detail) => ({
          message: `Aucun article ne correspond à « ${detail.query} »`,
          action: {
            label: `Créer « ${detail.query} »`,
            onPress: () => createArticle({ name: detail.query }),
          },
        })}
        renderSuccess={(view) => (
          <CatalogSections
            view={view}
            open={open}
            rowRefs={rowRefs}
            createInCategory={(categoryId) => createArticle({ categoryId })}
          />
        )}
      />
      <QuantityDialog request={request} onClose={closeDialog} />
    </View>
  );
};

const rowId = (row: Row) =>
  isEmptyCategory(row) ? `empty-${row.categoryId}` : row.id;

const CatalogSections = ({
  view,
  open,
  rowRefs,
  createInCategory,
}: {
  view: CatalogView;
  open: (article: CatalogArticle) => void;
  rowRefs: RowRefs;
  createInCategory: (categoryId: CategoryId) => void;
}) => (
  <SectionList<Row, { title: string }>
    // Named, so the end-to-end journeys can scroll it.
    accessibilityLabel="Articles du catalogue"
    sections={view.sections.map((section) => ({
      title: section.category.name,
      data:
        section.articles.length > 0
          ? section.articles
          : [{ empty: true, categoryId: section.category.id }],
    }))}
    keyExtractor={rowId}
    renderSectionHeader={({ section }) => (
      <List.Subheader accessibilityRole="header">
        {section.title}
      </List.Subheader>
    )}
    renderItem={({ item }) =>
      isEmptyCategory(item) ? (
        <View style={styles.emptyCategory}>
          <Text variant="bodyMedium">Aucun article dans cette catégorie</Text>
          <Button onPress={() => createInCategory(item.categoryId)}>
            Créer un article
          </Button>
        </View>
      ) : (
        <CatalogRow article={item} open={open} rowRefs={rowRefs} />
      )
    }
    stickySectionHeadersEnabled={false}
    // A phone shows about this many 48 dp rows: the first frame fills the screen.
    initialNumToRender={20}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={styles.content}
  />
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  content: { paddingBottom: spacing.xl },
  emptyCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: spacing.md,
    paddingEnd: spacing.sm,
  },
});
