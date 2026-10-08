import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { ErrorReporter } from '../../application/ports/error-reporter';
import { ScreenErrorBoundary } from './components/app-error-boundary';
import { NoticeSnackbar } from './components/NoticeSnackbar';
import { UndoSnackbar } from './components/UndoSnackbar';
import { AddArticlesScreen } from './screens/AddArticlesScreen';
import { CreateArticleScreen } from './screens/CreateArticleScreen';
import { CurrentListScreen } from './screens/CurrentListScreen';
import { EditArticleScreen } from './screens/EditArticleScreen';
import { ListsScreen } from './screens/ListsScreen';
import type { RootStackParamList } from './routes';
import { useNavigationTheme } from './theme/navigation-theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The app's screens, with the snackbars every screen shares (the undo offer stays across
 * screens, FR-010). The route shown is given to the
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
          <Stack.Screen name="EditArticle" component={EditArticleScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <UndoSnackbar />
      <NoticeSnackbar />
    </>
  );
};
