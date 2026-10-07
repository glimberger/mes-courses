import type { ReactNode } from 'react';

import type { ScreenState } from '../state/screen-state';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

export interface ScreenStateViewProps<T, E> {
  state: ScreenState<T, E>;
  /** The French message of the error state, for example "Impossible de charger la liste." */
  errorMessage: string;
  onRetry: () => void;
  /** What the empty state says, from the empty detail. */
  empty: (detail: E) => EmptyStateProps;
  renderSuccess: (data: T) => ReactNode;
}

/** Renders one data region's state with the shared state components (Principle IX). */
export const ScreenStateView = <T, E = never>({
  state,
  errorMessage,
  onRetry,
  empty,
  renderSuccess,
}: ScreenStateViewProps<T, E>) => {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <LoadingState />;
    case 'error':
      return <ErrorState message={errorMessage} onRetry={onRetry} />;
    case 'empty':
      return <EmptyState {...empty(state.detail)} />;
    case 'success':
      return renderSuccess(state.data);
  }
};
