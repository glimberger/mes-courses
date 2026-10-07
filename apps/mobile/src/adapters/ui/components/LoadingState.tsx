import { ActivityIndicator } from 'react-native-paper';

import { StateLayout } from './StateLayout';

/** A data region being loaded (Principle IX). */
export const LoadingState = () => (
  <StateLayout>
    <ActivityIndicator accessibilityLabel="Chargement" />
  </StateLayout>
);
