import { StyleSheet, View } from 'react-native';
import { Button, Icon, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { StateLayout } from './StateLayout';
import { StateMessage } from './StateMessage';

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  /** Soft brand-toned icon shown above the message. */
  icon?: string;
}

/** A data region that failed to load, with a way to try again (Principle IX). */
export const ErrorState = ({
  message,
  onRetry,
  icon = 'alert-circle-outline',
}: ErrorStateProps) => {
  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  const circle = 56;
  return (
    <StateLayout>
      <View
        style={[
          styles.iconCircle,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            backgroundColor: colors.surfaceContainerHigh,
          },
        ]}
      >
        <Icon source={icon} size={32} color={colors.primary} />
      </View>
      <StateMessage>{message}</StateMessage>
      <Button mode="outlined" onPress={onRetry}>
        Réessayer
      </Button>
    </StateLayout>
  );
};

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
