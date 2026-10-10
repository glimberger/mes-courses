import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Pairing } from '@mes-courses/sync-core';
import type { SyncServer } from '../../../application/ports/sync-server';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { err, ok } from '../../../domain/result';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';

// 003 T071 installs expo-device; the model is what the name field starts from.
jest.mock('expo-device', () => ({ modelName: 'Pixel 8' }), { virtual: true });

const pairing: Pairing = {
  serverId: 'server-1',
  apiVersion: 1,
  minAppVersion: '1.0.0',
  deviceId: 'device-1',
  credential: 'secret-credential',
};

type Claim = Awaited<ReturnType<SyncServer['claim']>>;
type Health = Awaited<ReturnType<SyncServer['health']>>;

const reachable = (claim: Claim, health?: Health): Partial<SyncServer> => ({
  health: async () =>
    health ??
    ok({ serverId: 'server-1', apiVersion: 1, minAppVersion: '1.0.0' }),
  claim: async () => claim,
});

const renderConnect = async (syncServer: Partial<SyncServer> = {}) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed: fixture, asScreen: false, syncServer },
  );
  await screen.findByText('Ma liste');
  fireEvent.press(screen.getByRole('button', { name: 'Réglages' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Connecter à un serveur' }),
  );
  await screen.findByRole('header', { name: 'Connecter à un serveur' });
  return rendered;
};

const fill = (address: string, code: string) => {
  fireEvent.changeText(screen.getByLabelText('Adresse du serveur'), address);
  fireEvent.changeText(screen.getByLabelText("Code d'appairage"), code);
};

const connect = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Connecter' }));

describe('ConnectServer', () => {
  it('shows the three fields and the "Connecter" button', async () => {
    await renderConnect();

    expect(screen.getByLabelText('Adresse du serveur')).toBeOnTheScreen();
    expect(screen.getByLabelText("Code d'appairage")).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom de cet appareil')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Connecter' })).toBeOnTheScreen();
  });

  it('US4-4 prefills the device name with the device model', async () => {
    await renderConnect();

    expect(screen.getByLabelText('Nom de cet appareil').props.value).toBe(
      'Pixel 8',
    );
  });

  it('FR-019c caps the device name at 60 characters', async () => {
    await renderConnect();

    fireEvent.changeText(
      screen.getByLabelText('Nom de cet appareil'),
      'x'.repeat(80),
    );

    expect(
      screen.getByLabelText('Nom de cet appareil').props.value,
    ).toHaveLength(60);
  });

  it('US4-4 goes back to Settings with "Appareil connecté. Synchronisation en cours…" on success', async () => {
    await renderConnect(reachable(ok(pairing)));
    fill('courses.example.fr', 'ABCD-EF23');

    connect();

    expect(
      await screen.findByText('Appareil connecté. Synchronisation en cours…'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Réglages' })).toBeOnTheScreen();
    expect(await screen.findByText('courses.example.fr')).toBeOnTheScreen();
  });

  it('US4-4 sends the typed address, code and device name to the server', async () => {
    const claim = jest.fn(async () => ok(pairing));
    await renderConnect({ ...reachable(ok(pairing)), claim });
    fill('courses.example.fr', 'abcd-ef23');
    fireEvent.changeText(
      screen.getByLabelText('Nom de cet appareil'),
      'Pixel de Léa',
    );

    connect();

    await waitFor(() => expect(claim).toHaveBeenCalledTimes(1));
    expect(claim).toHaveBeenCalledWith(
      'https://courses.example.fr',
      'abcd-ef23',
      'Pixel de Léa',
    );
  });

  it.each([
    [
      'InvalidUrl',
      'Saisissez une adresse comme courses.example.fr.',
      'http://courses.example.fr',
      reachable(ok(pairing)),
    ],
    [
      'ServerUnreachable',
      "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.",
      'courses.example.fr',
      reachable(ok(pairing), err({ type: 'ServerUnreachable' })),
    ],
    [
      'InvalidCode',
      "Ce code n'est pas valide ou a expiré. Demandez un nouveau code.",
      'courses.example.fr',
      reachable(err({ type: 'InvalidCode' })),
    ],
    [
      'TooManyAttempts',
      "Trop d'essais. Réessayez dans 7 minutes.",
      'courses.example.fr',
      reachable(err({ type: 'TooManyAttempts', minutesToWait: 7 })),
    ],
  ] as [string, string, string, Partial<SyncServer>][])(
    'shows the %s outcome as "%s" without leaving the screen',
    async (_type, message, address, syncServer) => {
      await renderConnect(syncServer);
      fill(address, 'ABCD-EF23');

      connect();

      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(
        screen.getByRole('header', { name: 'Connecter à un serveur' }),
      ).toBeOnTheScreen();
    },
  );

  it('US4-6 US4-12 US4-5 does not report a refused or unreachable connection', async () => {
    const { errorReporter } = await renderConnect(
      reachable(ok(pairing), err({ type: 'ServerUnreachable' })),
    );
    fill('courses.example.fr', 'ABCD-EF23');

    connect();
    await screen.findByText(
      "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.",
    );

    expect(errorReporter.reports).toEqual([]);
  });

  it('FR-019 shows UntrustedServer as the certificate message and reports it once, without the address', async () => {
    const { errorReporter } = await renderConnect(
      reachable(ok(pairing), err({ type: 'UntrustedServer' })),
    );
    fill('courses.example.fr', 'ABCD-EF23');

    connect();

    expect(
      await screen.findByText(
        "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur.",
      ),
    ).toBeOnTheScreen();
    expect(errorReporter.reports).toHaveLength(1);
    expect(errorReporter.reports[0]?.context).toEqual({
      operation: 'connectToServer',
      screen: 'ConnectServer',
    });
    expect(JSON.stringify(errorReporter.reports)).not.toContain(
      'courses.example.fr',
    );
  });

  it('keeps what was typed after a failure', async () => {
    await renderConnect(reachable(err({ type: 'InvalidCode' })));
    fill('courses.example.fr', 'ABCD-EF23');

    connect();
    await screen.findByText(
      "Ce code n'est pas valide ou a expiré. Demandez un nouveau code.",
    );

    expect(screen.getByLabelText('Adresse du serveur').props.value).toBe(
      'courses.example.fr',
    );
    expect(screen.getByLabelText("Code d'appairage").props.value).toBe(
      'ABCD-EF23',
    );
  });
});
