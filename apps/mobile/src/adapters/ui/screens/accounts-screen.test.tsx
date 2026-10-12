import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { AccountSummary } from '@mes-courses/sync-core';

import type { AdminServer } from '../../../application/ports/admin-server';
import { InMemoryAdminServer } from '../../../application/testing/in-memory-admin-server';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';

const connected = {
  serverUrl: 'https://courses.example.fr',
  lastSyncAt: '2026-10-12T08:00:00.000Z',
};

const account = (
  id: string,
  email: string,
  overrides: Partial<AccountSummary> = {},
): AccountSummary => ({
  id,
  email,
  role: 'user',
  state: 'active',
  lastSyncAt: null,
  invitationExpired: false,
  ...overrides,
});

const administrator = account('account-1', 'admin@example.org', {
  role: 'administrator',
});

/** An administrator's phone, opened on the Accounts screen from Settings. */
const openAccounts = async (
  adminServer: Partial<AdminServer> | InMemoryAdminServer,
  scenario: StoryScenario = {},
) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    {
      seed: fixture,
      asScreen: false,
      connected,
      syncServer: { listDevices: async () => ({ ok: true, value: [] }) },
      accountServer: {
        getAccount: async () => ({
          ok: true,
          value: {
            id: 'account-1',
            email: 'admin@example.org',
            role: 'administrator',
          },
        }),
      },
      adminServer: adminServerOf(adminServer),
      ...scenario,
    },
  );
  await screen.findByText('Ma liste');
  fireEvent.press(screen.getByRole('button', { name: 'Réglages' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Gérer les comptes' }),
  );
  await screen.findByRole('header', { name: 'Comptes' });
  return rendered;
};

const adminServerOf = (
  server: Partial<AdminServer> | InMemoryAdminServer,
): Partial<AdminServer> =>
  server instanceof InMemoryAdminServer
    ? {
        listAccounts: server.listAccounts,
        invite: server.invite,
      }
    : server;

describe('Accounts', () => {
  it('004 US5-1 shows one row per account with its address, its state and its last synchronization', async () => {
    await openAccounts(
      new InMemoryAdminServer([
        administrator,
        account('account-2', 'lea@example.org', {
          lastSyncAt: '2026-10-12T07:00:00.000Z',
        }),
        account('account-3', 'marc@example.org', { state: 'invited' }),
        account('account-4', 'anne@example.org', {
          state: 'invited',
          invitationExpired: true,
        }),
        account('account-5', 'paul@example.org', { state: 'suspended' }),
      ]),
    );

    expect(await screen.findByText('lea@example.org')).toBeOnTheScreen();
    expect(screen.getByText('admin@example.org')).toBeOnTheScreen();
    expect(screen.getAllByText('Actif')).toHaveLength(2);
    expect(screen.getByText('Invité, pas encore connecté')).toBeOnTheScreen();
    expect(screen.getByText('Invitation expirée')).toBeOnTheScreen();
    expect(screen.getByText('Suspendu')).toBeOnTheScreen();
    expect(
      screen.getAllByText('Dernière synchronisation : Jamais').length,
    ).toBe(4);
  });

  it('004 FR-019 shows a loading state, then the empty state when only the administrator exists', async () => {
    await openAccounts(new InMemoryAdminServer([administrator]));

    expect(
      await screen.findByText('Vous êtes le seul utilisateur.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: "Inviter quelqu'un" }),
    ).toBeOnTheScreen();
  });

  it('004 FR-019 shows the error state with "Réessayer" and loads again', async () => {
    const listAccounts = jest
      .fn<ReturnType<AdminServer['listAccounts']>, []>()
      .mockResolvedValueOnce({ ok: false, error: { type: 'ServerError' } })
      .mockResolvedValue({
        ok: true,
        value: [administrator, account('a-2', 'lea@example.org')],
      });
    await openAccounts({ listAccounts });

    expect(
      await screen.findByText('Impossible de charger les comptes.'),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('lea@example.org')).toBeOnTheScreen();
  });

  it('004 FR-007 says without an error state that the list is unavailable offline', async () => {
    const server = new InMemoryAdminServer();
    server.offline = true;
    await openAccounts(server);

    expect(
      await screen.findByText('Liste des comptes indisponible hors connexion.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Impossible de charger les comptes.')).toBeNull();
  });
});

describe('InviteAccountDialog', () => {
  const openDialog = async (server: InMemoryAdminServer) => {
    await openAccounts(server);
    await screen.findByText('Vous êtes le seul utilisateur.');
    openFromAppbar();
    await dialogTitle();
  };
  // Both the frame and its title are headers.
  const dialogHeaders = () =>
    screen.queryAllByRole('header', { name: "Inviter quelqu'un" });
  const dialogTitle = () =>
    waitFor(() => expect(dialogHeaders().length).toBeGreaterThan(0));
  const openFromAppbar = () =>
    fireEvent.press(
      screen.getAllByRole('button', { name: 'Inviter' })[0] as never,
    );
  // The dialog's button comes after the Appbar's in the tree.
  const submit = (email: string) => {
    fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), email);
    fireEvent.press(
      screen.getAllByRole('button', { name: 'Inviter' }).at(-1) as never,
    );
  };

  it('004 shows the text of the dialog', async () => {
    await openDialog(new InMemoryAdminServer([administrator]));

    expect(
      screen.getByText(
        'La personne recevra un e-mail avec un mot de passe temporaire.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
  });

  it('004 US1-1 invites the address, says so and lists the invited account', async () => {
    const server = new InMemoryAdminServer([administrator]);
    await openDialog(server);

    submit('marie@example.org');

    expect(
      await screen.findByText('Invitation envoyée à marie@example.org.'),
    ).toBeOnTheScreen();
    expect(
      await screen.findByText('Invité, pas encore connecté'),
    ).toBeOnTheScreen();
    await waitFor(() => expect(dialogHeaders()).toHaveLength(0));
  });

  it('004 US1-2 says the address already has an account and keeps the dialog open', async () => {
    const server = new InMemoryAdminServer([
      administrator,
      account('account-2', 'marie@example.org'),
    ]);
    await openAccounts(server);
    await screen.findByText('marie@example.org');
    openFromAppbar();
    await dialogTitle();

    submit('Marie@example.org');

    expect(
      await screen.findByText('Cette adresse a déjà un compte.'),
    ).toBeOnTheScreen();
    expect(dialogHeaders().length).toBeGreaterThan(0);
  });

  it('004 US1-3 refuses an address that is not valid', async () => {
    await openDialog(new InMemoryAdminServer([administrator]));

    submit('not an address');

    expect(
      await screen.findByText('Saisissez une adresse e-mail valide.'),
    ).toBeOnTheScreen();
  });

  it('004 US1-4 says the invitation could not be sent', async () => {
    const server = new InMemoryAdminServer([administrator]);
    await openDialog(server);
    server.mailFails = true;

    submit('marie@example.org');

    expect(
      await screen.findByText(
        "L'invitation n'a pas pu être envoyée. Réessayez.",
      ),
    ).toBeOnTheScreen();
    expect(server.accounts).toEqual([administrator]);
  });

  it('004 FR-007 says a connection to the server is needed when offline', async () => {
    const server = new InMemoryAdminServer([administrator]);
    await openDialog(server);
    server.offline = true;

    submit('marie@example.org');

    expect(
      await screen.findByText('Connexion au serveur nécessaire.'),
    ).toBeOnTheScreen();
  });

  it('004 closes with "Annuler" and sends nothing', async () => {
    const server = new InMemoryAdminServer([administrator]);
    await openDialog(server);

    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() => expect(dialogHeaders()).toHaveLength(0));
    expect(server.invited).toEqual([]);
  });
});
