import {
  TABS,
  type CatalogStackParamList,
  type CoursesStackParamList,
  type ListsStackParamList,
  type RootStackParamList,
  type RootTabParamList,
  type SettingsStackParamList,
} from './routes';

// Each tab's root route, checked against its stack's param list by the compiler.
const ROOTS = {
  CoursesTab: 'CurrentList' satisfies keyof CoursesStackParamList,
  ListsTab: 'Lists' satisfies keyof ListsStackParamList,
  ArticlesTab: 'Catalog' satisfies keyof CatalogStackParamList,
  SettingsTab: 'Settings' satisfies keyof SettingsStackParamList,
} as const satisfies Record<keyof RootTabParamList, keyof RootStackParamList>;

describe('tab routes', () => {
  it('lists the four tabs in order, with their label and icon', () => {
    expect(TABS.map(({ name, label, icon }) => [name, label, icon])).toEqual([
      ['CoursesTab', 'Courses', 'shopping_cart'],
      ['ListsTab', 'Listes', 'format_list_bulleted'],
      ['ArticlesTab', 'Articles', 'grocery'],
      ['SettingsTab', 'Réglages', 'settings'],
    ]);
  });

  it('gives each tab the root route of its stack', () => {
    expect(
      Object.fromEntries(TABS.map(({ name, root }) => [name, root])),
    ).toEqual(ROOTS);
  });

  it('has no EditArticle route: the edit dialog replaced it', () => {
    const routes: string[] = [
      'CurrentList',
      'AddArticles',
      'CreateArticle',
      'Catalog',
    ] satisfies (keyof CoursesStackParamList | keyof CatalogStackParamList)[];
    expect(routes).not.toContain('EditArticle');
  });
});
