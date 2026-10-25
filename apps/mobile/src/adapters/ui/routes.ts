import type {
  NavigationProp,
  NavigatorScreenParams,
} from '@react-navigation/native';

import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';

type CreateArticleParams = {
  /** The name to start from, and the category to choose, if any (FR-008, FR-018). */
  name?: string;
  categoryId?: CategoryId;
  /** True from Courses (also adds to the current list), false from Articles (catalog only). */
  addToList: boolean;
};

/** Courses tab: the current list, the add screen and article creation. */
export type CoursesStackParamList = {
  CurrentList: undefined;
  AddArticles: undefined;
  CreateArticle: CreateArticleParams;
  /** Kept until the edit dialog replaces it (phase 5). */
  EditArticle: { articleId: ArticleId };
};

/** Listes tab. */
export type ListsStackParamList = {
  Lists: undefined;
};

/** Articles tab: the catalog, and article creation (catalog only). */
export type CatalogStackParamList = {
  Catalog: undefined;
  CreateArticle: CreateArticleParams;
  EditArticle: { articleId: ArticleId };
};

/** Réglages tab. */
export type SettingsStackParamList = {
  Settings: undefined;
  SignIn: undefined;
  /** What was typed on SignIn, kept in memory only; the temporary password is never stored. */
  ChoosePassword: {
    url: string;
    email: string;
    temporaryPassword: string;
    deviceName: string;
  };
  Accounts: undefined;
};

/** The bottom tabs, each holding the stack above (contracts/ui-screens.md#navigation). */
export type RootTabParamList = {
  CoursesTab: NavigatorScreenParams<CoursesStackParamList> | undefined;
  ListsTab: NavigatorScreenParams<ListsStackParamList> | undefined;
  ArticlesTab: NavigatorScreenParams<CatalogStackParamList> | undefined;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

/** Every route of every stack: a screen navigates by name, React Navigation finds the stack. */
export type RootStackParamList = CoursesStackParamList &
  ListsStackParamList &
  CatalogStackParamList &
  SettingsStackParamList;

/**
 * What a screen navigates with: to a route of its own stack by name, or to a screen of another
 * tab through its tab (`navigate('ListsTab', { screen: 'Lists' })`).
 */
export type AppNavigation = NavigationProp<
  RootTabParamList & RootStackParamList
>;

/** The tabs in display order: the route, the bar's label and icon, and the root of its stack. */
export const TABS = [
  {
    name: 'CoursesTab',
    label: 'Courses',
    icon: 'shopping_cart',
    root: 'CurrentList',
  },
  {
    name: 'ListsTab',
    label: 'Listes',
    icon: 'format_list_bulleted',
    root: 'Lists',
  },
  { name: 'ArticlesTab', label: 'Articles', icon: 'grocery', root: 'Catalog' },
  {
    name: 'SettingsTab',
    label: 'Réglages',
    icon: 'settings',
    root: 'Settings',
  },
] as const satisfies readonly {
  name: keyof RootTabParamList;
  label: string;
  icon: string;
  root: keyof RootStackParamList;
}[];

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // An interface, so it merges with React Navigation's declaration.
    interface RootParamList extends RootTabParamList, RootStackParamList {}
  }
}
