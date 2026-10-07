import type { ReactElement } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { UnitOfWork } from '../../../application/ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../../../application/testing/in-memory-repositories';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { SequentialIdGenerator } from '../../../application/testing/sequential-id-generator';
import {
  createInitializeStore,
  type Seed,
} from '../../../application/use-cases/initialize-store';
import { createAppStore } from '../state/app-store';
import { AppStoreProvider } from '../state/app-store-provider';
import { ThemeProvider } from '../theme/theme-provider';
import type { UseCases } from '../use-cases';

const Stack = createNativeStackNavigator();

// Jest has no window to measure: a phone-sized frame with no insets.
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Renders `ui` as the only screen of a navigator, under the theme and a fresh store whose use
 * cases run on new in-memory fakes, holding `seed` when one is given.
 */
export const renderWithStore = async (
  ui: ReactElement,
  { seed }: { seed?: Seed } = {},
) => {
  const unitOfWork: UnitOfWork = new InMemoryUnitOfWork(
    new InMemoryRepositories(),
  );
  const useCases: UseCases = {
    initializeStore: createInitializeStore({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    }),
  };
  if (seed) await useCases.initializeStore(seed);
  const errorReporter = new RecordingErrorReporter();
  const store = createAppStore({ useCases, errorReporter });
  const Screen = () => ui;

  const result = render(
    <ThemeProvider>
      <AppStoreProvider store={store}>
        <SafeAreaProvider initialMetrics={metrics}>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Test" component={Screen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </AppStoreProvider>
    </ThemeProvider>,
  );
  return { ...result, store, errorReporter, unitOfWork };
};
