import { fireEvent, screen } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';

/** The app on the fixture, opened on CurrentList. */
const renderApp = async (scenario: StoryScenario = {}) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed: fixture, asScreen: false, ...scenario },
  );
  await screen.findByText('Ma liste');
  return rendered;
};

const openSettings = async (scenario: StoryScenario = {}) => {
  const rendered = await renderApp(scenario);
  fireEvent.press(screen.getByRole('button', { name: 'Réglages' }));
  await screen.findByRole('header', { name: 'Réglages' });
  return rendered;
};

describe('Settings', () => {
  it('US4-1 adds an Appbar action "Réglages" to CurrentList', async () => {
    await renderApp();

    expect(screen.getByRole('button', { name: 'Réglages' })).toBeOnTheScreen();
  });

  it('US4-1 opens Settings titled "Réglages" from that action', async () => {
    await openSettings();

    expect(screen.getByRole('header', { name: 'Réglages' })).toBeOnTheScreen();
  });

  describe('when the device was never connected', () => {
    it('US4-1 explains synchronization and offers "Connecter à un serveur"', async () => {
      await openSettings();

      expect(
        screen.getByText(
          'Synchronisez vos listes avec votre serveur pour les retrouver sur vos autres appareils.',
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Connecter à un serveur' }),
      ).toBeOnTheScreen();
    });

    it('shows no server section and no sync status bar', async () => {
      await openSettings();

      expect(screen.queryByText(/Dernière synchronisation/)).toBeNull();
      expect(screen.queryByText('Synchronisé')).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Synchroniser maintenant' }),
      ).toBeNull();
    });

    it('opens ConnectServer from "Connecter à un serveur"', async () => {
      await openSettings();

      fireEvent.press(
        screen.getByRole('button', { name: 'Connecter à un serveur' }),
      );

      expect(
        await screen.findByRole('header', { name: 'Connecter à un serveur' }),
      ).toBeOnTheScreen();
    });
  });

  describe('when the device is connected', () => {
    const connected = {
      serverUrl: 'https://courses.example.fr',
      lastSyncAt: null,
    };

    it('US4-8 shows the server address without the scheme', async () => {
      await openSettings({ connected });

      expect(await screen.findByText('courses.example.fr')).toBeOnTheScreen();
      expect(
        screen.queryByText(
          'Synchronisez vos listes avec votre serveur pour les retrouver sur vos autres appareils.',
        ),
      ).toBeNull();
    });

    it('US4-8 shows "Jamais" when the device never synchronized', async () => {
      await openSettings({ connected });

      expect(
        await screen.findByText('Dernière synchronisation : Jamais'),
      ).toBeOnTheScreen();
    });

    it('US4-8 shows the time of the last synchronization', async () => {
      await openSettings({
        connected: { ...connected, lastSyncAt: '2026-10-06T10:00:00.000Z' },
      });

      const line = await screen.findByText(/^Dernière synchronisation : /);
      expect(line).toBeOnTheScreen();
      expect(line.props.children.join('')).not.toContain('Jamais');
    });
  });
});
