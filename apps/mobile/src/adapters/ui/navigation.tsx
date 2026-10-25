import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';

import type { ErrorReporter } from '../../application/ports/error-reporter';
import { ScreenErrorBoundary } from './components/app-error-boundary';
import { NoticeSnackbar } from './components/NoticeSnackbar';
import { TabBar } from './components/TabBar';
import { UndoSnackbar } from './components/UndoSnackbar';
import { AccountsScreen } from './screens/AccountsScreen';
import { AddArticlesScreen } from './screens/AddArticlesScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { ChoosePasswordScreen } from './screens/ChoosePasswordScreen';
import { CreateArticleScreen } from './screens/CreateArticleScreen';
import { CurrentListScreen } from './screens/CurrentListScreen';
import { EditArticleScreen } from './screens/EditArticleScreen';
import { ListsScreen } from './screens/ListsScreen';
import { SignedOutNotice } from './screens/SignedOutNoticeDialog';
import { SettingsScreen } from './screens/SettingsScreen';
import { SignInScreen } from './screens/SignInScreen';
import {
  TABS,
  type CatalogStackParamList,
  type CoursesStackParamList,
  type ListsStackParamList,
  type RootTabParamList,
  type SettingsStackParamList,
} from './routes';
import { SyncAnnouncer } from './components/SyncAnnouncer';
import { useAndroidKeyboardShown } from './keyboard';
import { useNavigationTheme } from './theme/navigation-theme';

const Tab = createBottomTabNavigator<RootTabParamList>();
const CoursesStack = createNativeStackNavigator<CoursesStackParamList>();
const ListsStack = createNativeStackNavigator<ListsStackParamList>();
const CatalogStack = createNativeStackNavigator<CatalogStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

// Every stack hides its header (each screen draws its own) and wraps its screens in their own
// error boundary, so a screen that fails while drawing is reported with its own route, even on
// its first render (FR-039a).
const stackOptions = { headerShown: false } as const;
const screenLayout = ({
  route,
  children,
}: {
  route: { name: string };
  children: ReactNode;
}) => <ScreenErrorBoundary screen={route.name}>{children}</ScreenErrorBoundary>;

const CoursesNavigator = () => (
  <CoursesStack.Navigator
    initialRouteName="CurrentList"
    screenOptions={stackOptions}
    screenLayout={screenLayout}
  >
    <CoursesStack.Screen name="CurrentList" component={CurrentListScreen} />
    <CoursesStack.Screen name="AddArticles" component={AddArticlesScreen} />
    <CoursesStack.Screen name="CreateArticle" component={CreateArticleScreen} />
    <CoursesStack.Screen name="EditArticle" component={EditArticleScreen} />
  </CoursesStack.Navigator>
);

const ListsNavigator = () => (
  <ListsStack.Navigator
    screenOptions={stackOptions}
    screenLayout={screenLayout}
  >
    <ListsStack.Screen name="Lists" component={ListsScreen} />
  </ListsStack.Navigator>
);

const CatalogNavigator = () => (
  <CatalogStack.Navigator
    screenOptions={stackOptions}
    screenLayout={screenLayout}
  >
    <CatalogStack.Screen name="Catalog" component={CatalogScreen} />
    <CatalogStack.Screen name="CreateArticle" component={CreateArticleScreen} />
  </CatalogStack.Navigator>
);

const SettingsNavigator = () => (
  <SettingsStack.Navigator
    screenOptions={stackOptions}
    screenLayout={screenLayout}
  >
    <SettingsStack.Screen name="Settings" component={SettingsScreen} />
    <SettingsStack.Screen name="SignIn" component={SignInScreen} />
    <SettingsStack.Screen
      name="ChoosePassword"
      component={ChoosePasswordScreen}
    />
    <SettingsStack.Screen name="Accounts" component={AccountsScreen} />
  </SettingsStack.Navigator>
);

const NAVIGATORS = {
  CoursesTab: CoursesNavigator,
  ListsTab: ListsNavigator,
  ArticlesTab: CatalogNavigator,
  SettingsTab: SettingsNavigator,
} as const;

/**
 * The bar for the navigator: it tells the tab pressed, as the stock bar does, so a press on the
 * selected tab lets its stack return to its root, and a press on another tab shows it with the
 * history it had. On Android it gives way to the keyboard while the user types, as the stock
 * bar's `tabBarHideOnKeyboard` would.
 */
const NavigationTabBar = ({ state, navigation }: BottomTabBarProps) => {
  const keyboardShown = useAndroidKeyboardShown();
  const selected = state.routes[state.index];
  if (keyboardShown) return null;
  return (
    <TabBar
      tabs={TABS.map(({ name, label, icon }) => ({ key: name, label, icon }))}
      selectedKey={selected?.name ?? TABS[0].name}
      onSelect={(key) => {
        const route = state.routes.find(({ name }) => name === key);
        if (!route) return;
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (route.key !== selected?.key && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
    />
  );
};

/**
 * The app's four tabs, each with its own stack of screens (Courses, Listes, Articles, Réglages),
 * opening on Courses, with the snackbars every screen shares (the undo offer stays across
 * screens, FR-010) above the tab bar. The route shown is given to the reporter whenever it
 * changes, so every report names a screen (contracts/driven-ports.md); it is the screen's own
 * route, not its tab's.
 */
export const Navigation = ({
  errorReporter,
}: {
  errorReporter: ErrorReporter;
}) => {
  const navigationRef = useNavigationContainerRef<RootTabParamList>();
  const theme = useNavigationTheme();
  const recordScreen = () => {
    const route = navigationRef.getCurrentRoute();
    if (route) errorReporter.setScreen(route.name);
  };

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={theme}
        onReady={recordScreen}
        onStateChange={recordScreen}
      >
        <Tab.Navigator
          initialRouteName="CoursesTab"
          screenOptions={{ headerShown: false }}
          // Rendered as a component, not called as a function, so it may use hooks.
          tabBar={(props) => <NavigationTabBar {...props} />}
        >
          {TABS.map(({ name }) => (
            <Tab.Screen key={name} name={name} component={NAVIGATORS[name]} />
          ))}
        </Tab.Navigator>
      </NavigationContainer>
      <SyncAnnouncer />
      <UndoSnackbar />
      <NoticeSnackbar />
      <SignedOutNotice />
    </>
  );
};
