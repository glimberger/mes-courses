import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { err, ok } from '../../../domain/result';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { waitForMenusToSettle } from '../testing/wait-for-menus';

const connected = {
  serverUrl: 'https://courses.example.fr',
  lastSyncAt: null,
};

const devices = [
  {
    id: 'story-device',
    name: 'Pixel de Léa',
    createdAt: '2026-09-01T10:00:00.000Z',
    lastSyncAt: null,
  },
  {
    id: 'device-2',
    name: 'iPhone de Marc',
    createdAt: '2026-09-02T10:00:00.000Z',
    lastSyncAt: '2026-09-30T08:00:00.000Z',
  },
];

const openSettings = async (scenario: StoryScenario = {}) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed: fixture, asScreen: false, connected, ...scenario },
  );
  await screen.findByText('Ma liste');
  fireEvent.press(screen.getByRole('button', { name: 'Réglages' }));
  await screen.findByText('Réglages');
  return rendered;
};

const withDevices = (extra: StoryScenario['syncServer'] = {}) => ({
  syncServer: { listDevices: async () => ok(devices), ...extra },
});

const openRowMenu = async (name: string) => {
  const button = await screen.findByLabelText(`Actions de ${name}`);
  await waitForMenusToSettle();
  fireEvent.press(button);
};

describe('Settings, devices (003 US4)', () => {
  describe('the Appareils section', () => {
    it('US4-8 lists each device with its last sync, and marks this one', async () => {
      await openSettings(withDevices());

      expect(await screen.findByText('Pixel de Léa')).toBeOnTheScreen();
      expect(screen.getByText('iPhone de Marc')).toBeOnTheScreen();
      expect(screen.getAllByText('Cet appareil')).toHaveLength(1);
      expect(
        screen.getAllByText('Dernière synchronisation : Jamais'),
      ).toHaveLength(2);
    });

    it('shows a loading state while the list loads', async () => {
      await openSettings({ pending: ['listDevices'] });

      expect(await screen.findByLabelText('Chargement')).toBeOnTheScreen();
    });

    it('shows the error and "Réessayer", and reports it', async () => {
      const { errorReporter } = await openSettings({
        failing: ['listDevices'],
      });

      expect(
        await screen.findByText('Impossible de charger les appareils.'),
      ).toBeOnTheScreen();
      expect(errorReporter.reports).toHaveLength(1);
      expect(errorReporter.reports[0]?.context).toMatchObject({
        operation: 'listDevices',
      });
      expect(
        screen.getByRole('button', { name: 'Réessayer' }),
      ).toBeOnTheScreen();
    });

    it('retries from the error state', async () => {
      const listDevices = jest
        .fn()
        .mockResolvedValueOnce(err({ type: 'ServerError' }))
        .mockResolvedValue(ok(devices));
      await openSettings({ syncServer: { listDevices } });
      fireEvent.press(await screen.findByRole('button', { name: 'Réessayer' }));

      expect(await screen.findByText('iPhone de Marc')).toBeOnTheScreen();
    });

    it('revoked: says the list is unavailable, with no "Réessayer"', async () => {
      await openSettings({
        syncServer: {
          listDevices: async () => err({ type: 'DeviceNotAuthorized' }),
        },
      });

      expect(
        await screen.findByText(
          'Liste des appareils indisponible pour le moment.',
        ),
      ).toBeOnTheScreen();
      expect(
        screen.queryByText('Impossible de charger les appareils.'),
      ).not.toBeOnTheScreen();
    });

    it('offline: says so, with no error and nothing reported', async () => {
      const { errorReporter } = await openSettings();

      expect(
        await screen.findByText(
          'Liste des appareils indisponible hors connexion.',
        ),
      ).toBeOnTheScreen();
      expect(errorReporter.reports).toEqual([]);
    });
  });

  describe('"Renommer"', () => {
    it('renames the device with the typed name', async () => {
      const renameDevice = jest.fn(async () => ok(undefined));
      await openSettings(withDevices({ renameDevice }));
      await openRowMenu('iPhone de Marc');
      fireEvent.press(await screen.findByText('Renommer'));

      expect(await screen.findByText("Renommer l'appareil")).toBeOnTheScreen();
      fireEvent.changeText(screen.getByLabelText('Nom'), '  iPad de Marc ');
      fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() =>
        expect(renameDevice).toHaveBeenCalledWith(
          expect.objectContaining({ deviceId: 'story-device' }),
          'device-2',
          'iPad de Marc',
        ),
      );
      await waitFor(() =>
        expect(screen.queryByText("Renommer l'appareil")).toBeNull(),
      );
    });

    it('shows the name errors of 001 and keeps the dialog open', async () => {
      const renameDevice = jest.fn(async () => ok(undefined));
      await openSettings(withDevices({ renameDevice }));
      await openRowMenu('iPhone de Marc');
      fireEvent.press(await screen.findByText('Renommer'));
      fireEvent.changeText(await screen.findByLabelText('Nom'), '   ');
      fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(await screen.findByText('Indiquez un nom.')).toBeOnTheScreen();
      expect(renameDevice).not.toHaveBeenCalled();
    });

    it('is offered for this device too', async () => {
      await openSettings(withDevices());
      await openRowMenu('Pixel de Léa');

      expect(await screen.findByText('Renommer')).toBeOnTheScreen();
    });
  });

  describe('"Révoquer"', () => {
    it('US4-9 asks first, then revokes', async () => {
      const revokeDevice = jest.fn(async () => ok(undefined));
      await openSettings(withDevices({ revokeDevice }));
      await openRowMenu('iPhone de Marc');
      fireEvent.press(await screen.findByText('Révoquer'));

      expect(
        await screen.findByText('Révoquer « iPhone de Marc » ?'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Cet appareil ne pourra plus synchroniser. Ses données restent sur l'appareil.",
        ),
      ).toBeOnTheScreen();
      fireEvent.press(screen.getByRole('button', { name: 'Révoquer' }));

      await waitFor(() =>
        expect(revokeDevice).toHaveBeenCalledWith(
          expect.objectContaining({ deviceId: 'story-device' }),
          'device-2',
        ),
      );
    });

    it('Annuler revokes nothing', async () => {
      const revokeDevice = jest.fn(async () => ok(undefined));
      await openSettings(withDevices({ revokeDevice }));
      await openRowMenu('iPhone de Marc');
      fireEvent.press(await screen.findByText('Révoquer'));
      fireEvent.press(await screen.findByRole('button', { name: 'Annuler' }));

      await waitFor(() => expect(screen.queryByText(/Révoquer/)).toBeNull());
      expect(revokeDevice).not.toHaveBeenCalled();
    });

    it('is not offered on this device', async () => {
      await openSettings(withDevices());
      await openRowMenu('Pixel de Léa');
      await screen.findByText('Renommer');

      expect(screen.queryByText('Révoquer')).toBeNull();
    });
  });

  it('US4-10 after a revocation the bar offers "Se reconnecter", which opens SignIn', async () => {
    const sync = jest.fn(async () =>
      err({ type: 'DeviceNotAuthorized' as const }),
    );
    const { store } = await openSettings({ syncServer: { sync } });
    await act(() => store.getState().syncNow());

    expect(
      await screen.findByText(
        "Cet appareil n'est plus autorisé. Reconnectez-vous.",
      ),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Se reconnecter' }));

    expect(
      await screen.findByRole('header', { name: 'Se connecter' }),
    ).toBeOnTheScreen();
  });

  it('004 US5-4 explains the sign-out in a dialog, and "Compris" erases the local copy', async () => {
    const sync = jest.fn(async () => err({ type: 'AccountDeleted' as const }));
    const { store } = await openSettings({ syncServer: { sync } });
    await act(() => store.getState().syncNow());

    expect(await screen.findByText('Compte supprimé')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Ce compte a été supprimé. Les listes de ce compte vont être effacées de cet appareil.',
      ),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Compris' }));

    await waitFor(() =>
      expect(store.getState().sync.connection).toBe('notConnected'),
    );
    expect(store.getState().sync.signedOutReason).toBeNull();
    expect(screen.queryByText('Compte supprimé')).not.toBeOnTheScreen();
  });
});
