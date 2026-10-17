import type { Ref } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { StateLayout } from './StateLayout';
import { StateMessage } from './StateMessage';

export interface EmptyStateProps {
  /** Hierarchically styled title shown above the message, when provided. */
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
  /** The message, for a focus move to the empty state (FR-037). */
  messageRef?: Ref<HostInstance> | undefined;
  /** Soft brand-toned icon shown above the message. */
  icon?: string;
}

/** A data region with nothing to show, and what the user can do about it (Principle IX). */
export const EmptyState = ({
  title,
  message,
  action,
  messageRef,
  icon = 'shopping_basket',
}: EmptyStateProps) => {
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
      {title && (
        <Text variant="titleMedium" style={{ color: colors.onSurface }}>
          {title}
        </Text>
      )}
      <StateMessage ref={messageRef}>{message}</StateMessage>
      {action && (
        <Button mode="outlined" onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </StateLayout>
  );
};

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
