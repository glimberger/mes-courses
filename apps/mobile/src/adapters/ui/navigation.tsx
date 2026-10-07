import {
  NavigationContainer,
  useNavigation,
  useNavigationContainerRef,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { Appbar } from 'react-native-paper';

import type { ErrorReporter } from '../../application/ports/error-reporter';
import { NoticeSnackbar } from './components/NoticeSnackbar';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { useNavigationTheme } from './theme/navigation-theme';

/** The app's routes, by name; none takes a parameter yet (contracts/ui-screens.md#navigation). */
export type RootStackParamList = {
  CurrentList: undefined;
  Lists: undefined;
  AddArticles: undefined;
  CreateArticle: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // An interface, so it merges with React Navigation's declaration.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

const Stack = createNativeStackNavigator<RootStackParamList>();

const CurrentListScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <PlaceholderScreen title="Liste en cours">
      <Appbar.Action
        icon="format-list-bulleted"
        accessibilityLabel="Mes listes"
        onPress={() => navigation.navigate('Lists')}
      />
    </PlaceholderScreen>
  );
};
const ListsScreen = () => <PlaceholderScreen title="Mes listes" />;
const AddArticlesScreen = () => (
  <PlaceholderScreen title="Ajouter des articles" />
);
const CreateArticleScreen = () => <PlaceholderScreen title="Nouvel article" />;

/**
 * The app's screens, with the snackbars every screen shares. The route shown is given to the
 * reporter whenever it changes, so every report names a screen (contracts/driven-ports.md).
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
