import type { Ref } from 'react';
import type { HostInstance } from 'react-native';

import { Button } from './Button';
import { StateLayout } from './StateLayout';
import { StateMessage } from './StateMessage';

export interface EmptyStateProps {
  message: string;
  action?: { label: string; onPress: () => void };
  /** The message, for a focus move to the empty state (FR-037). */
  messageRef?: Ref<HostInstance> | undefined;
}

/** A data region with nothing to show, and what the user can do about it (Principle IX). */
export const EmptyState = ({
  message,
  action,
  messageRef,
}: EmptyStateProps) => (
  <StateLayout>
    <StateMessage ref={messageRef}>{message}</StateMessage>
    {action && (
      <Button mode="outlined" onPress={action.onPress}>
        {action.label}
      </Button>
    )}
  </StateLayout>
);
