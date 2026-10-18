import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ArticleId } from '../../../domain/article';
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

const account = async () =>
  ok({ id: 'account-1', email: 'lea@example.org', role: 'user' as const });

const openSettings = async (
  scenario: StoryScenario = {},
  ready = 'lea@example.org',
) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    {
      seed: fixture,
      asScreen: false,
      connected,
      ...scenario,
      syncServer: { listDevices: async () => ok([]), ...scenario.syncServer },
      accountServer: { getAccount: account, ...scenario.accountServer },
    },
  );
  await screen.findByText('Ma liste');
  fireEvent.press(screen.getByRole('button', { name: 'Réglages' }));
  await screen.findByText(ready);
  return rendered;
};

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

describe('Settings, my account (004 US6)', () => {
  describe('"Changer de mot de passe"', () => {
    const open = async (scenario: StoryScenario = {}) => {
      const rendered = await openSettings(scenario);
      press('Changer de mot de passe');
      await screen.findByLabelText('Mot de passe actuel');
      return rendered;
    };
    const fill = (current: string, next: string, confirmation = next) => {
      type('Mot de passe actuel', current);
      type('Nouveau mot de passe', next);
      type('Confirmer le mot de passe', confirmation);
      press('Enregistrer');
    };

    it('US6-2 changes the password, closes and says so', async () => {
      const changePassword = jest.fn(async () => ok(undefined));
      const { store } = await open({ accountServer: { changePassword } });

      fill('mot de passe actuel', 'nouveau mot de passe');

      await waitFor(() =>
        expect(store.getState().notice).toEqual({ type: 'passwordChanged' }),
      );
      expect(changePassword).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'story-device' }),
        'mot de passe actuel',
        'nouveau mot de passe',
      );
      await waitFor(() =>
        expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull(),
      );
      expect(screen.getByText('Mot de passe modifié.')).toBeOnTheScreen();
    });

    it('US6-2 refuses the same password locally, without a request', async () => {
      const changePassword = jest.fn(async () => ok(undefined));
      await open({ accountServer: { changePassword } });

      fill('mot de passe actuel', 'mot de passe actuel');

      expect(
        await screen.findByText(
          "Choisissez un mot de passe différent de l'actuel.",
        ),
      ).toBeOnTheScreen();
      expect(changePassword).not.toHaveBeenCalled();
    });

    it('says when the entries differ', async () => {
      await open();

      fill('mot de passe actuel', 'nouveau mot de passe', 'autre mot de passe');

      expect(
        await screen.findByText(
          'Les deux mots de passe ne sont pas identiques.',
        ),
      ).toBeOnTheScreen();
    });

    it.each([
      [
        'a wrong current password',
        { type: 'InvalidCredentials' as const },
        'Mot de passe actuel incorrect.',
      ],
      [
        'too many attempts',
        { type: 'TooManyAttempts' as const, minutesToWait: 7 },
        "Trop d'essais. Réessayez dans 7 minutes.",
      ],
      [
        'a server that cannot be reached',
        { type: 'Offline' as const },
        'Connexion au serveur nécessaire.',
      ],
    ])(
      'says why on %s and keeps the dialog open',
      async (_, error, message) => {
        await open({
          accountServer: { changePassword: async () => err(error) },
        });

        fill('mot de passe actuel', 'nouveau mot de passe');

        expect(await screen.findByText(message)).toBeOnTheScreen();
        expect(screen.getByLabelText('Mot de passe actuel')).toBeOnTheScreen();
      },
    );

    it('Annuler changes nothing', async () => {
      const changePassword = jest.fn(async () => ok(undefined));
      await open({ accountServer: { changePassword } });

      press('Annuler');

      await waitFor(() =>
        expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull(),
      );
      expect(changePassword).not.toHaveBeenCalled();
    });
  });

  describe('"Se déconnecter de cet appareil"', () => {
    it('US6-4 asks first, then signs out: the copy is erased and SignIn opens', async () => {
      const revokeDevice = jest.fn(async () => ok(undefined));
      const { store, unitOfWork } = await openSettings({
        syncServer: { revokeDevice },
      });

      press('Se déconnecter de cet appareil');
      expect(
        await screen.findByText('Se déconnecter de cet appareil ?'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Vos listes seront effacées de cet appareil. Elles restent sur votre compte.',
        ),
      ).toBeOnTheScreen();
      press('Se déconnecter');

      await screen.findByRole('header', { name: 'Connexion' });
      expect(revokeDevice).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'story-device' }),
        'story-device',
      );
      expect(store.getState().sync.connection).toBe('notConnected');
      expect(
        await unitOfWork.run((repos) => repos.syncState.get()),
      ).toMatchObject({ serverUrl: null });
    });

    it('US6-4 says how many changes will be lost and changes the button', async () => {
      const { store } = await openSettings({
        prepare: async (actions) => {
          await actions.loadCurrentList();
          await actions.toggleItem('article-lait' as ArticleId);
        },
      });
      expect(store.getState().sync.pendingCount).toBe(1);

      press('Se déconnecter de cet appareil');

      expect(
        await screen.findByText(
          "1 modification n'a pas encore été envoyée et sera perdue.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Se déconnecter quand même' }),
      ).toBeOnTheScreen();
    });

    it('Annuler signs nothing out', async () => {
      const revokeDevice = jest.fn(async () => ok(undefined));
      const { store } = await openSettings({ syncServer: { revokeDevice } });

      press('Se déconnecter de cet appareil');
      await screen.findByText('Se déconnecter de cet appareil ?');
      press('Annuler');

      await waitFor(() =>
        expect(
          screen.queryByText('Se déconnecter de cet appareil ?'),
        ).toBeNull(),
      );
      expect(revokeDevice).not.toHaveBeenCalled();
      expect(store.getState().sync.connection).toBe('connected');
    });

    it('US6-4 works offline: it only clears the device', async () => {
      const { store } = await openSettings({
        syncServer: { revokeDevice: async () => err({ type: 'Offline' }) },
      });

      press('Se déconnecter de cet appareil');
      await screen.findByText('Se déconnecter de cet appareil ?');
      press('Se déconnecter');

      await screen.findByRole('header', { name: 'Connexion' });
      expect(store.getState().sync.connection).toBe('notConnected');
    });
  });

  describe('"Supprimer mon compte"', () => {
    const open = async (scenario: StoryScenario = {}) => {
      const rendered = await openSettings(scenario);
      press('Supprimer mon compte');
      await screen.findByText('Supprimer votre compte ?');
      return rendered;
    };
    const confirm = (password: string) => {
      type('Mot de passe', password);
      const buttons = screen.getAllByRole('button', {
        name: 'Supprimer mon compte',
      });
      // The dialog's button comes after the one of Settings.
      fireEvent.press(buttons[buttons.length - 1] as (typeof buttons)[number]);
    };

    it('US6-6 deletes the account with the password and opens SignIn', async () => {
      const deleteAccount = jest.fn(async () => ok(undefined));
      const { store } = await open({ accountServer: { deleteAccount } });
      expect(
        screen.getByText(
          'Votre compte et toutes vos listes seront supprimés du serveur, sans retour possible.',
        ),
      ).toBeOnTheScreen();

      confirm('mon mot de passe');

      await screen.findByRole('header', { name: 'Connexion' });
      expect(deleteAccount).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'story-device' }),
        'mon mot de passe',
      );
      expect(store.getState().sync.connection).toBe('notConnected');
    });

    it.each([
      [
        'a wrong password',
        { type: 'InvalidCredentials' as const },
        'Mot de passe incorrect.',
      ],
      [
        'the only administrator',
        { type: 'LastAdministrator' as const },
        'Le seul administrateur ne peut pas supprimer son compte.',
      ],
    ])(
      'US6-6 US6-7 says why on %s and changes nothing',
      async (_, error, message) => {
        const { store } = await open({
          accountServer: { deleteAccount: async () => err(error) },
        });

        confirm('mon mot de passe');

        expect(await screen.findByText(message)).toBeOnTheScreen();
        expect(store.getState().sync.connection).toBe('connected');
      },
    );
  });

  describe('offline', () => {
    it('US6-1 the actions that need the server say so and open nothing', async () => {
      await openSettings(
        { accountServer: { getAccount: async () => err({ type: 'Offline' }) } },
        'Compte indisponible hors connexion.',
      );
      expect(screen.queryByText('lea@example.org')).toBeNull();

      press('Changer de mot de passe');
      expect(
        await screen.findByText('Connexion au serveur nécessaire.'),
      ).toBeOnTheScreen();
      press('Supprimer mon compte');

      expect(
        screen.getAllByText('Connexion au serveur nécessaire.'),
      ).toHaveLength(1);
      expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull();
      expect(screen.queryByText('Supprimer votre compte ?')).toBeNull();
    });
  });
});
