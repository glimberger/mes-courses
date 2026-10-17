import type { Ref } from 'react';
import { StyleSheet, type HostInstance } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { Button } from './Button';
import { IconCircle } from './IconCircle';
import { StateLayout } from './StateLayout';
import { StateMessage } from './StateMessage';

export interface EmptyStateProps {
  /** The title above the message, in titleLarge, when provided. */
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
  /** The message, for a focus move to the empty state (FR-037). */
  messageRef?: Ref<HostInstance> | undefined;
  /** A Material Symbol name, drawn in a brand circle above the message. */
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
  const { colors } = useTheme() as AppTheme;
  return (
    <StateLayout>
      <IconCircle icon={icon} diameter={56} />
      {title && (
        <Text
          variant="titleLarge"
          style={[styles.title, { color: colors.onSurface }]}
        >
          {title}
        </Text>
      )}
      <StateMessage ref={messageRef}>{message}</StateMessage>
      {action && (
        <Button mode="brand" onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </StateLayout>
  );
};

const styles = StyleSheet.create({
  title: { textAlign: 'center' },
});
