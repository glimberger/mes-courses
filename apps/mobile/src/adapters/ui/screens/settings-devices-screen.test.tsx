import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { err, ok } from '../../../domain/result';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';

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
  fireEvent.press(await screen.findByLabelText(`Actions de ${name}`));
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

  describe('"Déconnecter cet appareil"', () => {
    it('US4-11 asks first, then disconnects and shows the not-connected Settings', async () => {
      const revokeDevice = jest.fn(async () => ok(undefined));
      await openSettings(withDevices({ revokeDevice }));
      fireEvent.press(
        await screen.findByRole('button', { name: 'Déconnecter cet appareil' }),
      );

      expect(
        await screen.findByText('Déconnecter cet appareil ?'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Vos listes restent sur cet appareil mais ne seront plus synchronisées.',
        ),
      ).toBeOnTheScreen();
      fireEvent.press(screen.getByRole('button', { name: 'Déconnecter' }));

      expect(
        await screen.findByRole('button', { name: 'Connecter à un serveur' }),
      ).toBeOnTheScreen();
      expect(revokeDevice).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'story-device' }),
        'story-device',
      );
    });
  });

  describe('"Ajouter un appareil"', () => {
    it('US4-3 shows the code and when it expires', async () => {
      const expiresAt = new Date(2026, 9, 6, 14, 5).toISOString();
      await openSettings(
        withDevices({
          createPairingCode: async () => ok({ code: 'ABCD-EF23', expiresAt }),
        }),
      );
      fireEvent.press(
        await screen.findByRole('button', { name: 'Ajouter un appareil' }),
      );

      // The title shows with the button behind the dialog.
      expect(await screen.findAllByText('Ajouter un appareil')).toHaveLength(2);
      expect(await screen.findByText('ABCD-EF23')).toBeOnTheScreen();
      expect(screen.getByText("Valable jusqu'à 14:05.")).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Sur le nouvel appareil, ouvrez Réglages › Connecter à un serveur et saisissez :',
        ),
      ).toBeOnTheScreen();
      fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
      await waitFor(() => expect(screen.queryByText('ABCD-EF23')).toBeNull());
    });

    it('US4-3 offline: needs the server, with nothing reported', async () => {
      const { errorReporter } = await openSettings();
      fireEvent.press(
        await screen.findByRole('button', { name: 'Ajouter un appareil' }),
      );

      expect(
        await screen.findByText(
          'Connexion au serveur nécessaire pour ajouter un appareil.',
        ),
      ).toBeOnTheScreen();
      expect(errorReporter.reports).toEqual([]);
    });
  });

  describe('"Modifier l\'adresse"', () => {
    const open = async (changeScenario: StoryScenario['syncServer'] = {}) => {
      const rendered = await openSettings(withDevices(changeScenario));
      fireEvent.press(
        await screen.findByRole('button', { name: "Modifier l'adresse" }),
      );
      await screen.findByText("Modifier l'adresse du serveur");
      return rendered;
    };

    it('is prefilled and saves a new address of the same server', async () => {
      const health = jest.fn(async () =>
        ok({ serverId: 'story-server', apiVersion: 1, minAppVersion: '1.0.0' }),
      );
      const { store } = await open({ health });
      const field = screen.getByLabelText('Adresse du serveur');
      expect(field.props.value).toBe('courses.example.fr');

      fireEvent.changeText(field, 'nouveau.example.fr');
      fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() =>
        expect(store.getState().sync.serverUrl).toBe(
          'https://nouveau.example.fr',
        ),
      );
      expect(health).toHaveBeenCalledWith('https://nouveau.example.fr');
      await waitFor(() =>
        expect(screen.queryByText("Modifier l'adresse du serveur")).toBeNull(),
      );
    });

    it.each([
      [
        'unreachable',
        () => err({ type: 'ServerUnreachable' as const }),
        'nouveau.example.fr',
        "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.",
      ],
      [
        'untrusted',
        () => err({ type: 'UntrustedServer' as const }),
        'nouveau.example.fr',
        "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur.",
      ],
      [
        'another server',
        () => ok({ serverId: 'other', apiVersion: 1, minAppVersion: '1.0.0' }),
        'nouveau.example.fr',
        'Cette adresse ne correspond pas à votre serveur.',
      ],
      [
        'invalid',
        () =>
          ok({ serverId: 'story-server', apiVersion: 1, minAppVersion: '1' }),
        'http://nouveau.example.fr',
        'Saisissez une adresse comme courses.example.fr.',
      ],
    ])(
      'says why on %s, and keeps the old address',
      async (_, health, typed, message) => {
        const { store } = await open({ health: async () => health() } as never);
        fireEvent.changeText(
          screen.getByLabelText('Adresse du serveur'),
          typed,
        );
        fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

        expect(await screen.findByText(message)).toBeOnTheScreen();
        expect(store.getState().sync.serverUrl).toBe(
          'https://courses.example.fr',
        );
      },
    );
  });

  it('US4-10 after a revocation the bar offers "Se reconnecter", which opens ConnectServer', async () => {
    const sync = jest.fn(async () =>
      err({ type: 'DeviceNotAuthorized' as const }),
    );
    const { store } = await openSettings({ syncServer: { sync } });
    await act(() => store.getState().syncNow());

    expect(
      await screen.findByText("Cet appareil n'est plus connecté au serveur."),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Se reconnecter' }));

    expect(await screen.findByText('Connecter à un serveur')).toBeOnTheScreen();
  });
});
