import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ArticleId } from '../../../domain/article';
import type { CatalogView } from '../../../domain/catalog-view';
import type { CategoryId } from '../../../domain/category';
import { cleanName } from '../../../domain/name';
import { AppbarIconAction } from '../components/AppbarIconAction';
import { ArticleRow } from '../components/ArticleRow';
import { Button } from '../components/Button';
import { CategoryHeader } from '../components/CategoryHeader';
import { EmptyCategoryCard } from '../components/EmptyCategoryCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenStateView } from '../components/ScreenStateView';
import { SearchField } from '../components/SearchField';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { hasScreenBelow } from '../navigation-history';
import type { RootStackParamList } from '../routes';
import { useAppStoreApi } from '../state/app-store-provider';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';

type CatalogArticle = CatalogView['sections'][number]['articles'][number];

/** Stands for the one row of a category with no article (US2-15). */
type EmptyCategory = { empty: true; categoryId: CategoryId };

type Row = CatalogArticle | EmptyCategory;

const isEmptyCategory = (row: Row): row is EmptyCategory => 'empty' in row;

/** The articles on the list when the screen opened: hidden for the whole visit. */
type Snapshot = ReadonlySet<ArticleId>;

const idsOnList = (view: CatalogView): Snapshot =>
  new Set(
    view.sections.flatMap((section) =>
      section.articles
        .filter((article) => article.onList)
        .map((article) => article.id),
    ),
  );

type CatalogRowProps = {
  article: CatalogArticle;
  toggle: (article: CatalogArticle) => void;
};

/** A row whose callbacks stay the same between renders, so typing does not draw it again. */
const CatalogRow = memo(function CatalogRow({
  article,
  toggle,
}: CatalogRowProps) {
  const onPress = useCallback(() => toggle(article), [article, toggle]);
  return (
    <ArticleRow name={article.name} added={article.onList} onPress={onPress} />
  );
});

/**
 * The catalog, to add articles to the current list with a tap each (User Story 3): every
 * category, searched as the user types without reading storage again (SC-011, R11a). A tap adds
 * the article with no quantity, a second tap takes it off again. The articles on the list when
 * the screen opened stay hidden; those added during the visit (including a newly created one)
 * are not in that snapshot, so they stay shown, marked as added. The screen stays open, so
 * several articles can be added in a row.
 */
export const AddArticlesScreen = ({
  initialQuery = '',
}: {
  /** The search the screen opens with: for the stories, which cannot type. */
  initialQuery?: string;
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const store = useAppStoreApi();
  const catalog = useAppStore((state) => state.catalog.view);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const searchCatalog = useAppStore((state) => state.searchCatalog);
  const addArticleToList = useAppStore((state) => state.addArticleToList);
  const removeItemQuietly = useAppStore((state) => state.removeItemQuietly);

  // The snapshot is taken from the catalog this screen loaded itself, never from one a former
  // visit left in the store, so it is null (loading) until then.
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const load = useCallback(async (): Promise<Snapshot | null> => {
    await loadCatalog();
    const { full } = store.getState().catalog;
    return full.status === 'success' ? idsOnList(full.data) : null;
  }, [loadCatalog, store]);
  const adopt = useCallback((taken: Snapshot | null) => {
    if (taken !== null) setSnapshot((current) => current ?? taken);
  }, []);

  // The catalog is loaded once per screen, the search is kept per screen: the store holds one
  // query only, shared with the Articles tab's screen, so each puts its own back in the store
  // whenever it is shown, which also repairs the store after the other one left. Closing this
  // screen drops its search, so it opens on the whole catalog the next time.
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    void load().then(adopt);
    return () => searchCatalog('');
  }, [searchCatalog, load, adopt]);
  useFocusEffect(
    useCallback(() => {
      searchCatalog(query);
    }, [query, searchCatalog]),
  );

  const toggle = useCallback(
    (article: CatalogArticle) => {
      if (article.onList) void removeItemQuietly(article.id);
      else void addArticleToList({ id: article.id, name: article.name }, null);
    },
    [addArticleToList, removeItemQuietly],
  );

  const createArticle = (
    params?: Omit<RootStackParamList['CreateArticle'], 'addToList'>,
  ) => navigation.navigate('CreateArticle', { ...params, addToList: true });

  /** "Nouvel article", named after the search if there is one (FR-008, FR-022). */
  const newArticle = () => {
    const name = cleanName(query);
    createArticle(name === '' ? undefined : { name });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Ajouter des articles"
        titleVariant="titleLarge"
        onBack={
          hasScreenBelow(navigation) ? () => navigation.goBack() : undefined
        }
        actions={
          <AppbarIconAction
            icon="add"
            accessibilityLabel="Nouvel article"
            onPress={newArticle}
          />
        }
      />
      <SyncStatusBar />
      <SearchField
        placeholder="Rechercher un article"
        value={query}
        onChangeText={setQuery}
      />
      <ScreenStateView
        state={
          catalog.status === 'success' && snapshot === null
            ? { status: 'loading' }
            : catalog
        }
        errorMessage="Impossible de charger les articles."
        onRetry={() => void load().then(adopt)}
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
            hidden={snapshot ?? EMPTY_SNAPSHOT}
            searching={cleanName(query) !== ''}
            toggle={toggle}
            createInCategory={(categoryId) => createArticle({ categoryId })}
            create={() => createArticle()}
          />
        )}
      />
    </View>
  );
};

const EMPTY_SNAPSHOT: Snapshot = new Set();

const rowId = (row: Row) =>
  isEmptyCategory(row) ? `empty-${row.categoryId}` : row.id;

const CatalogSections = ({
  view,
  hidden,
  searching,
  toggle,
  createInCategory,
  create,
}: {
  view: CatalogView;
  hidden: Snapshot;
  searching: boolean;
  toggle: (article: CatalogArticle) => void;
  createInCategory: (categoryId: CategoryId) => void;
  create: () => void;
}) => {
  const { sections, alreadyOnList } = useMemo(() => {
    const shown = view.sections.flatMap((section) => {
      const articles = section.articles.filter(
        (article) => !hidden.has(article.id),
      );
      // A category whose articles are all hidden is not empty: it is left out, not offered a
      // creation card.
      if (articles.length === 0 && section.articles.length > 0) return [];
      return [
        {
          title: section.category.name,
          categoryId: section.category.id,
          articles,
        },
      ];
    });
    const names = view.sections.flatMap((section) =>
      section.articles
        .filter((article) => hidden.has(article.id))
        .map((article) => article.name),
    );
    return { sections: shown, alreadyOnList: names };
  }, [view, hidden]);

  // The matches are all hidden: say so, with no action (FR-012). When a shown article matches
  // too, the shown one is listed and the text is not.
  if (searching && sections.length === 0 && alreadyOnList.length > 0) {
    return (
      <View style={styles.already}>
        {alreadyOnList.map((name) => (
          <Text key={name} variant="bodyLarge">
            {`« ${name} » est déjà dans la liste`}
          </Text>
        ))}
      </View>
    );
  }

  // Without a search, every article is on the list already: say so, and offer to create one.
  if (sections.length === 0 && alreadyOnList.length > 0) {
    return (
      <View style={styles.already}>
        <Text variant="bodyLarge">
          Tous les articles sont déjà dans la liste
        </Text>
        <Button mode="text" onPress={create}>
          Créer un article
        </Button>
      </View>
    );
  }

  return (
    <SectionList<Row, { title: string; categoryId: CategoryId }>
      // Named, so the end-to-end journeys can scroll it.
      accessibilityLabel="Articles du catalogue"
      sections={sections.map(({ title, categoryId, articles }) => ({
        title,
        categoryId,
        data: articles.length > 0 ? articles : [{ empty: true, categoryId }],
      }))}
      keyExtractor={rowId}
      renderSectionHeader={({ section }) => (
        <CategoryHeader title={section.title} />
      )}
      renderItem={({ item }) => (
        <View style={styles.item}>
          {isEmptyCategory(item) ? (
            <EmptyCategoryCard
              message="Aucun article dans cette catégorie"
              actionLabel="Créer un article"
              onAction={() => createInCategory(item.categoryId)}
            />
          ) : (
            <CatalogRow article={item} toggle={toggle} />
          )}
        </View>
      )}
      stickySectionHeadersEnabled={false}
      // A phone shows about this many 48 dp rows: the first frame fills the screen.
      initialNumToRender={20}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    />
  );
};

// The mockups' rows: cards 16 dp from the sides and 10 dp apart.
const CARD_GAP = 10;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  item: { paddingHorizontal: spacing.md, paddingBottom: CARD_GAP },
  already: { padding: spacing.md, gap: spacing.sm },
});
