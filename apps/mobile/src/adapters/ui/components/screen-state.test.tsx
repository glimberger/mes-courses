import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ScreenState } from '../state/screen-state';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { ScreenStateView } from './ScreenStateView';

describe('LoadingState', () => {
  it('has the accessibility label "Chargement"', () => {
    render(<LoadingState />);

    expect(screen.getByLabelText('Chargement')).toBeOnTheScreen();
  });
});

describe('EmptyState', () => {
  it('shows its message and its action button', () => {
    const onPress = jest.fn();
    render(
      <EmptyState
        message="Cette liste est vide."
        action={{ label: 'Ajouter des articles', onPress }}
      />,
    );

    expect(screen.getByText('Cette liste est vide.')).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', { name: 'Ajouter des articles' }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows no button without an action', () => {
    render(<EmptyState message="Aucune liste." />);

    expect(screen.getByText('Aucune liste.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});

describe('ErrorState', () => {
  it('shows its message and a "Réessayer" button that calls onRetry', () => {
    const onRetry = jest.fn();
    render(
      <ErrorState
        message="Impossible de charger la liste."
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByText('Impossible de charger la liste.'),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('ScreenStateView', () => {
  const renderState = (
    state: ScreenState<string, { query: string }>,
    onRetry = jest.fn(),
  ) =>
    render(
      <ScreenStateView
        state={state}
        errorMessage="Impossible de charger les articles."
        onRetry={onRetry}
        empty={({ query }) => ({ message: `Aucun article pour « ${query} ».` })}
        renderSuccess={(data) => <Text>{data}</Text>}
      />,
    );

  const shown = () => ({
    loading: screen.queryByLabelText('Chargement') !== null,
    error: screen.queryByText('Impossible de charger les articles.') !== null,
    empty: screen.queryByText('Aucun article pour « riz ».') !== null,
    success: screen.queryByText('Lait') !== null,
  });

  const none = { loading: false, error: false, empty: false, success: false };

  it('renders nothing for a region never requested', () => {
    renderState({ status: 'idle' });

    expect(shown()).toEqual(none);
  });

  it('renders only LoadingState while loading', () => {
    renderState({ status: 'loading' });

    expect(shown()).toEqual({ ...none, loading: true });
  });

  it('renders only ErrorState on an error, and its "Réessayer" calls onRetry', () => {
    const onRetry = jest.fn();
    renderState({ status: 'error', error: new Error('boom') }, onRetry);

    expect(shown()).toEqual({ ...none, error: true });
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders only EmptyState, built from the empty detail, when empty', () => {
    renderState({ status: 'empty', detail: { query: 'riz' } });

    expect(shown()).toEqual({ ...none, empty: true });
  });

  it('renders only the success renderer with the data', () => {
    renderState({ status: 'success', data: 'Lait' });

    expect(shown()).toEqual({ ...none, success: true });
  });
});
