import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { Navigation } from '../navigation';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { ChangelogProvider } from '../changelog-context';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import { ChangelogView } from './ChangelogScreen';

const releases = [
  {
    version: '2.1.0',
    date: '2026-11-09',
    features: [{ text: 'rename a list' }],
    fixes: [],
  },
  {
    version: '2.0.1',
    date: '2026-11-07',
    features: [{ text: 'tab navigation' }],
    fixes: [{ text: 'keep the keyboard closed' }],
  },
];

describe('ChangelogView', () => {
  it('lists the versions newest first, each with its date and sections', () => {
    render(
      <PaperProvider>
        <ChangelogView releases={releases} onBack={undefined} />
      </PaperProvider>,
    );

    const versions = screen
      .getAllByText(/^Version /)
      .map((node) => node.props.children);
    expect(versions).toEqual(['Version 2.1.0', 'Version 2.0.1']);
    expect(screen.getByText('9 novembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('7 novembre 2026')).toBeOnTheScreen();
    // The screen title, then "Nouveautés" for each release; "Corrections" only for the release
    // that has fixes.
    expect(screen.getAllByText('Nouveautés')).toHaveLength(3);
    expect(screen.getAllByText('Corrections')).toHaveLength(1);
    expect(screen.getByText('• rename a list')).toBeOnTheScreen();
    expect(screen.getByText('• keep the keyboard closed')).toBeOnTheScreen();
  });

  it('shows an explicit message when there is no release', () => {
    render(
      <PaperProvider>
        <ChangelogView releases={[]} onBack={undefined} />
      </PaperProvider>,
    );

    expect(screen.getByText('Aucune nouveauté')).toBeOnTheScreen();
    expect(screen.queryByText(/^Version /)).not.toBeOnTheScreen();
  });

  it('shows the back action only when it can go back', () => {
    const onBack = jest.fn();
    render(
      <PaperProvider>
        <ChangelogView releases={[]} onBack={onBack} />
      </PaperProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('Nouveautés from Settings', () => {
  it('opens from the version row and goes back to Settings', async () => {
    await renderWithStore(
      <ChangelogProvider value={releases}>
        <Navigation errorReporter={new RecordingErrorReporter()} />
      </ChangelogProvider>,
      { seed: fixture, asScreen: false },
    );
    await screen.findByText('Ma liste');
    fireEvent.press(screen.getByRole('tab', { name: 'Réglages' }));
    await screen.findByRole('header', { name: 'Réglages' });

    fireEvent.press(screen.getByRole('button', { name: /^Version / }));
    expect(await screen.findByText('Version 2.1.0')).toBeOnTheScreen();
    expect(screen.getAllByText('Nouveautés').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(
      await screen.findByRole('header', { name: 'Réglages' }),
    ).toBeOnTheScreen();
  });
});
