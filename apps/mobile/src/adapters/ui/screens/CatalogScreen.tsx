import { useCallback, useEffect, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ArticleId } from '../../../domain/article';
import type { CatalogView } from '../../../domain/catalog-view';
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
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';

type CatalogArticle = CatalogView['sections'][number]['articles'][number];

/** The articles with their category, empty categories left out (AC1). */
const withArticles = (view: CatalogView) =>
  view.sections.filter((section) => section.articles.length > 0);

const rowId = (article: CatalogArticle) => article.id;

/**
 * The Articles tab's root: the whole catalog by category, searched as the user types, each row
 * with the number of lists holding the article (spec 011, Catalog).
 */
export const CatalogScreen = () => {
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
  // whenever it is shown, and drops it when it leaves, as the add screen does.
  const [query, setQuery] = useState('');
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
  const counts: ReadonlyMap<ArticleId, number> =
    usageCounts.status === 'success' ? usageCounts.data : new Map();

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Articles"
        titleVariant="titleLarge"
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
        renderSuccess={(view) => {
          const sections = withArticles(view);
          if (sections.length === 0) {
            return <EmptyState message="Aucun article" />;
          }
          return (
            <SectionList<CatalogArticle, { title: string }>
              // Named, so the end-to-end journeys can scroll it.
              accessibilityLabel="Articles du catalogue"
              sections={sections.map((section) => ({
                title: section.category.name,
                data: section.articles,
              }))}
              keyExtractor={rowId}
              renderSectionHeader={({ section }) => (
                <CategoryHeader title={section.title} />
              )}
              renderItem={({ item }) => (
                <View style={styles.item}>
                  <CatalogArticleRow
                    name={item.name}
                    count={counts.get(item.id) ?? 0}
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
