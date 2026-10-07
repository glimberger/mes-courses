import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';

const realFetch = global.fetch;
const offlineFetch = jest.fn(() => {
  throw new TypeError('Network request failed');
});

beforeEach(() => {
  offlineFetch.mockClear();
  global.fetch = offlineFetch as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('CurrentList with no network', () => {
  it('US1-5 opens the list and ticks items with no error shown or reported', async () => {
    const navigationReporter = new RecordingErrorReporter();
    const { unitOfWork, errorReporter } = await renderWithStore(
      <Navigation errorReporter={navigationReporter} />,
      { seed: fixture, asScreen: false },
    );

    fireEvent.press(
      await screen.findByRole('checkbox', {
        name: 'Lait, 2 L, pas dans le caddie',
      }),
    );
    fireEvent.press(
      screen.getByRole('checkbox', { name: 'Pommes, dans le caddie' }),
    );

    expect(
      screen.getByRole('checkbox', { name: 'Lait, 2 L, dans le caddie' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Pommes, pas dans le caddie' }),
    ).not.toBeChecked();
    await waitFor(async () => {
      const stored = await unitOfWork.run((repos) =>
        repos.items.find(
          'list-ma-liste' as ListId,
          'article-lait' as ArticleId,
        ),
      );
      expect(stored?.inCart).toBe(true);
    });
    expect(
      screen.queryByText("La modification n'a pas pu être enregistrée."),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByText('Impossible de charger la liste.'),
    ).not.toBeOnTheScreen();
    expect(errorReporter.reports).toEqual([]);
    expect(navigationReporter.reports).toEqual([]);
    expect(offlineFetch).not.toHaveBeenCalled();
  });
});
