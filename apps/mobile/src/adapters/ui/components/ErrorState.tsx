import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { Button } from './Button';
import { IconCircle } from './IconCircle';
import { StateLayout } from './StateLayout';
import { StateMessage } from './StateMessage';

export interface ErrorStateProps {
  /** The title above the message, in titleLarge, when provided. */
  title?: string;
  message: string;
  onRetry: () => void;
  /** A Material Symbol name, drawn in an error circle above the message. */
  icon?: string;
}

/** A data region that failed to load, with a way to try again (Principle IX). */
export const ErrorState = ({
  title,
  message,
  onRetry,
  icon = 'error',
}: ErrorStateProps) => {
  const { colors } = useTheme() as AppTheme;
  return (
    <StateLayout>
      <IconCircle icon={icon} diameter={56} tone="error" />
      {title && (
        <Text
          variant="titleLarge"
          style={[styles.title, { color: colors.onSurface }]}
        >
          {title}
        </Text>
      )}
      <StateMessage>{message}</StateMessage>
      <Button mode="brand" onPress={onRetry}>
        Réessayer
      </Button>
    </StateLayout>
  );
};

const styles = StyleSheet.create({
  title: { textAlign: 'center' },
});
