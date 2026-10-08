import { Button } from './Button';
import { StateLayout } from './StateLayout';
import { StateMessage } from './StateMessage';

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

/** A data region that failed to load, with a way to try again (Principle IX). */
export const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <StateLayout>
    <StateMessage>{message}</StateMessage>
    <Button mode="outlined" onPress={onRetry}>
      Réessayer
    </Button>
  </StateLayout>
);
