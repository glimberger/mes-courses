import { Button } from 'react-native-paper';

import { StateLayout } from './StateLayout';
import { StateMessage } from './StateMessage';

export interface EmptyStateProps {
  message: string;
  action?: { label: string; onPress: () => void };
}

/** A data region with nothing to show, and what the user can do about it (Principle IX). */
export const EmptyState = ({ message, action }: EmptyStateProps) => (
  <StateLayout>
    <StateMessage>{message}</StateMessage>
    {action && (
      <Button mode="outlined" onPress={action.onPress}>
        {action.label}
      </Button>
    )}
  </StateLayout>
);
