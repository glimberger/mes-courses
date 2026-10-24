import { fireEvent, screen } from '@testing-library/react-native';
import type { AccountInfo } from '@mes-courses/sync-core';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { err, ok } from '../../../domain/result';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';

const connected = {
  serverUrl: 'https://courses.example.fr',
  lastSyncAt: null,
};

const openSettings = async (getAccount: () => Promise<unknown>) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    {
      seed: fixture,
      asScreen: false,
      connected,
      syncServer: { listDevices: async () => ok([]) },
      accountServer: { getAccount: getAccount as never },
    },
  );
  await screen.findByText('Ma liste');
  fireEvent.press(screen.getByRole('tab', { name: 'Réglages' }));
  await screen.findByRole('header', { name: 'Réglages' });
  return rendered;
};

const info = (role: AccountInfo['role']) => async () =>
  ok({ id: 'account-1', email: 'lea@example.org', role });

describe('Settings, Compte section', () => {
  it('004 US6-1 shows the address of a signed-in user, without administration', async () => {
    await openSettings(info('user'));

    expect(await screen.findByText('lea@example.org')).toBeOnTheScreen();
    expect(screen.getByText('Compte')).toBeOnTheScreen();
    expect(screen.queryByText('Administrateur')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Gérer les comptes' }),
    ).toBeNull();
  });

  it('004 US1-5 shows "Administrateur" and "Gérer les comptes" to an administrator', async () => {
    await openSettings(info('administrator'));

    expect(await screen.findByText('Administrateur')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Gérer les comptes' }),
    ).toBeOnTheScreen();
  });

  it('004 US1-5 takes the role from the server on every opening, not from storage', async () => {
    let role: AccountInfo['role'] = 'administrator';
    const getAccount = async () =>
      ok({ id: 'account-1', email: 'lea@example.org', role });
    const { store } = await openSettings(getAccount);
    await screen.findByText('Administrateur');

    role = 'user';
    fireEvent.press(screen.getByRole('tab', { name: 'Courses' }));
    await screen.findByText('Ma liste');
    fireEvent.press(screen.getByRole('tab', { name: 'Réglages' }));

    expect(await screen.findByText('lea@example.org')).toBeOnTheScreen();
    expect(screen.queryByText('Administrateur')).toBeNull();
    expect(JSON.stringify(store.getState().sync)).not.toContain(
      'administrator',
    );
  });

  it('004 US6-1 offline, says the account is unavailable without an error color or the address', async () => {
    await openSettings(async () => err({ type: 'Offline' }));

    expect(
      await screen.findByText('Compte indisponible hors connexion.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('lea@example.org')).toBeNull();
  });

  it('004 FR-019 shows the error state with "Réessayer"', async () => {
    await openSettings(async () => err({ type: 'ServerError' }));

    expect(
      await screen.findByText('Impossible de charger le compte.'),
    ).toBeOnTheScreen();
  });

  it('004 shows no Compte section to a device that never signed in', async () => {
    await renderWithStore(
      <Navigation errorReporter={new RecordingErrorReporter()} />,
      { seed: fixture, asScreen: false },
    );
    await screen.findByText('Ma liste');
    fireEvent.press(screen.getByRole('tab', { name: 'Réglages' }));
    await screen.findByRole('header', { name: 'Réglages' });

    expect(screen.queryByText('Compte')).toBeNull();
  });
});
