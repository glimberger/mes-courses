import { ActivityIndicator, useTheme } from 'react-native-paper';

import { StateLayout } from './StateLayout';

/** A data region being loaded (Principle IX). */
export const LoadingState = () => {
  const { colors } = useTheme();
  return (
    <StateLayout>
      <ActivityIndicator
        accessibilityLabel="Chargement"
        color={colors.primary}
      />
    </StateLayout>
  );
};
