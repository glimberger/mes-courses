import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { ErrorReporter } from '../../application/ports/error-reporter';
import { ScreenErrorBoundary } from './components/app-error-boundary';
import { NoticeSnackbar } from './components/NoticeSnackbar';
import { CurrentListScreen } from './screens/CurrentListScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import type { RootStackParamList } from './routes';
import { useNavigationTheme } from './theme/navigation-theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const ListsScreen = () => <PlaceholderScreen title="Mes listes" />;
const AddArticlesScreen = () => (
  <PlaceholderScreen title="Ajouter des articles" />
);
const CreateArticleScreen = () => <PlaceholderScreen title="Nouvel article" />;

/**
 * The app's screens, with the snackbars every screen shares. The route shown is given to the
 * reporter whenever it changes, so every report names a screen (contracts/driven-ports.md).
 * Each screen has its own error boundary, so a screen that fails while drawing is reported with
 * its own route, even on its first render (FR-039a).
 */
export const Navigation = ({
  errorReporter,
}: {
  errorReporter: ErrorReporter;
}) => {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
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
        <Stack.Navigator
          initialRouteName="CurrentList"
          screenOptions={{ headerShown: false }}
          screenLayout={({ route, children }) => (
            <ScreenErrorBoundary screen={route.name}>
              {children}
            </ScreenErrorBoundary>
          )}
        >
          <Stack.Screen name="CurrentList" component={CurrentListScreen} />
          <Stack.Screen name="Lists" component={ListsScreen} />
          <Stack.Screen name="AddArticles" component={AddArticlesScreen} />
          <Stack.Screen name="CreateArticle" component={CreateArticleScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <NoticeSnackbar />
    </>
  );
};
