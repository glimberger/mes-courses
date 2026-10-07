import type { ReactNode } from 'react';

import type { ScreenState } from '../state/screen-state';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

type EmptyRenderer<E> = (detail: E) => EmptyStateProps;

// A region with no empty detail (`E = never`) can never be empty, so it takes no `empty`.
type EmptyProp<E> = [E] extends [never]
  ? { empty?: never }
  : {
      /** What the empty state says, from the empty detail. */
      empty: EmptyRenderer<E>;
    };

export type ScreenStateViewProps<T, E> = {
  state: ScreenState<T, E>;
  /** The French message of the error state, for example "Impossible de charger la liste." */
  errorMessage: string;
  onRetry: () => void;
  renderSuccess: (data: T) => ReactNode;
} & EmptyProp<E>;

/** Renders one data region's state with the shared state components (Principle IX). */
export const ScreenStateView = <T, E = never>(
  props: ScreenStateViewProps<T, E>,
) => {
  const { state, errorMessage, onRetry, renderSuccess } = props;
  const { empty } = props as { empty?: EmptyRenderer<E> };
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <LoadingState />;
    case 'error':
      return <ErrorState message={errorMessage} onRetry={onRetry} />;
    case 'empty':
      return empty ? <EmptyState {...empty(state.detail)} /> : null;
    case 'success':
      return renderSuccess(state.data);
  }
};
