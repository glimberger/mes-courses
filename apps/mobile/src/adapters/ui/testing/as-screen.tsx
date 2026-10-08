import type { ReactNode } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useNavigationTheme } from '../theme/navigation-theme';

const Stack = createNativeStackNavigator();

/**
 * `children` as the only screen of a navigator, so a screen can call `useNavigation`. Shared by
 * the stories and the screen tests, so both render a screen the same way. The screen is a render
 * callback, not a component made here, so a re-render updates it and never remounts it.
 */
export const AsScreen = ({
  children,
  params,
}: {
  children: ReactNode;
  /** The route params the screen reads with `useRoute`. */
  params?: object | undefined;
}) => {
  const theme = useNavigationTheme();
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Screen" initialParams={params}>
          {() => children}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};
