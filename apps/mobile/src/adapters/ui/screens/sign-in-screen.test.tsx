import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { AccountServer } from '../../../application/ports/account-server';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { err, ok } from '../../../domain/result';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { lightTheme } from '../theme/theme';
import { renderWithStore } from '../testing/render-with-store';

jest.mock('expo-device', () => ({ modelName: 'Pixel 8' }), { virtual: true });

const pairing = {
  serverId: 'server-1',
  apiVersion: 1,
  minAppVersion: '1.1.0',
  deviceId: 'device-1',
  credential: 'secret-credential',
  accountId: 'account-1',
};
const account = {
  id: 'account-1',
  email: 'marie@example.org',
  role: 'user' as const,
};
const reachable = {
  health: async () =>
    ok({ serverId: 'server-1', apiVersion: 1, minAppVersion: '1.1.0' }),
};

type SignIn = Awaited<ReturnType<AccountServer['signIn']>>;
type Choose = Awaited<ReturnType<AccountServer['choosePassword']>>;

const renderSignIn = async (
  accountServer: Partial<AccountServer> = {},
  syncServer: object = reachable,
) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed: fixture, asScreen: false, syncServer, accountServer },
  );
  await screen.findByText('Ma liste');
  fireEvent.press(screen.getByRole('button', { name: 'Réglages' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Se connecter' }));
  await screen.findByRole('header', { name: 'Se connecter' });
  return rendered;
};

const fill = (address: string, email: string, password: string) => {
  fireEvent.changeText(screen.getByLabelText('Adresse du serveur'), address);
  fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), email);
  fireEvent.changeText(screen.getByLabelText('Mot de passe'), password);
};

const submit = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Se connecter' }));

const signedIn: SignIn = ok({ type: 'signedIn', pairing, account });

describe('SignIn', () => {
  it('shows the four fields, the buttons and the device model', async () => {
    await renderSignIn();

    expect(screen.getByLabelText('Adresse du serveur')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adresse e-mail')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mot de passe')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom de cet appareil').props.value).toBe(
      'Pixel 8',
    );
    expect(
      screen.getByRole('button', { name: 'Mot de passe oublié ?' }),
    ).toBeOnTheScreen();
  });

  it('004 US2-1 signs in, goes back to Settings and says so', async () => {
    const signIn = jest.fn(async () => signedIn);
    await renderSignIn({ signIn });
    fill('courses.example.fr', 'Marie@Example.org', 'secret');

    submit();

    expect(
      await screen.findByText('Connecté. Synchronisation en cours…'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Réglages' })).toBeOnTheScreen();
    expect(signIn).toHaveBeenCalledWith(
      'https://courses.example.fr',
      'marie@example.org',
      'secret',
      'Pixel 8',
    );
  });

  it('004 US2-1 goes to ChoosePassword when the temporary password matched', async () => {
    await renderSignIn({
      signIn: async () => ok({ type: 'passwordChangeRequired' }),
    });
    fill('courses.example.fr', 'marie@example.org', 'ABCD-EFGH-JKMN-PQRS');

    submit();

    expect(
      await screen.findByRole('header', { name: 'Choisir votre mot de passe' }),
    ).toBeOnTheScreen();
  });

  it.each([
    [
      'InvalidUrl',
      'http://courses.example.fr',
      'marie@example.org',
      undefined,
      'Saisissez une adresse comme courses.example.fr.',
    ],
    [
      'InvalidEmail',
      'courses.example.fr',
      'nope',
      undefined,
      'Saisissez une adresse e-mail valide.',
    ],
    [
      'InvalidCredentials',
      'courses.example.fr',
      'marie@example.org',
      err({ type: 'InvalidCredentials' }),
      'Adresse e-mail ou mot de passe incorrect.',
    ],
    [
      'TemporaryPasswordExpired',
      'courses.example.fr',
      'marie@example.org',
      err({ type: 'TemporaryPasswordExpired' }),
      'Ce mot de passe temporaire a expiré. Choisissez « Mot de passe oublié ? » pour en recevoir un nouveau.',
    ],
    [
      'AccountSuspended',
      'courses.example.fr',
      'marie@example.org',
      err({ type: 'AccountSuspended' }),
      "Ce compte est suspendu. Contactez l'administrateur du serveur.",
    ],
    [
      'TooManyAttempts',
      'courses.example.fr',
      'marie@example.org',
      err({ type: 'TooManyAttempts', minutesToWait: 7 }),
      "Trop d'essais. Réessayez dans 7 minutes.",
    ],
    [
      'ServerUnreachable',
      'courses.example.fr',
      'marie@example.org',
      err({ type: 'ServerUnreachable' }),
      "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.",
    ],
  ] as [string, string, string, SignIn | undefined, string][])(
    'shows %s as "%s" and stays on the screen',
    async (_type, address, email, result, message) => {
      await renderSignIn({ signIn: async () => result ?? signedIn });
      fill(address, email, 'secret');

      submit();

      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(
        screen.getByRole('header', { name: 'Se connecter' }),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText('Adresse du serveur').props.value).toBe(
        address,
      );
    },
  );

  it('004 US2-4 reports an untrusted server once, without the address or the email', async () => {
    const { errorReporter } = await renderSignIn(
      {},
      {
        health: async () => err({ type: 'UntrustedServer' }),
      },
    );
    fill('courses.example.fr', 'marie@example.org', 'secret');

    submit();

    expect(
      await screen.findByText(
        "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur.",
      ),
    ).toBeOnTheScreen();
    expect(errorReporter.reports).toHaveLength(1);
    expect(errorReporter.reports[0]?.context).toEqual({
      operation: 'signIn',
      screen: 'SignIn',
    });
    const text = JSON.stringify(errorReporter.reports);
    expect(text).not.toContain('courses.example.fr');
    expect(text).not.toContain('marie@example.org');
  });

  it('004 US2-4 does not report a wrong password or an unreachable server', async () => {
    const { errorReporter } = await renderSignIn({
      signIn: async () => err({ type: 'InvalidCredentials' }),
    });
    fill('courses.example.fr', 'marie@example.org', 'secret');

    submit();
    await screen.findByText('Adresse e-mail ou mot de passe incorrect.');

    expect(errorReporter.reports).toEqual([]);
  });
});

describe('ChoosePassword', () => {
  const openChoose = async (
    choosePassword?: Partial<AccountServer>['choosePassword'],
  ) => {
    const rendered = await renderSignIn({
      signIn: async () => ok({ type: 'passwordChangeRequired' }),
      ...(choosePassword ? { choosePassword } : {}),
    });
    fill('courses.example.fr', 'marie@example.org', 'ABCD-EFGH-JKMN-PQRS');
    submit();
    await screen.findByRole('header', { name: 'Choisir votre mot de passe' });
    return rendered;
  };

  const choose = (password: string, confirmation = password) => {
    fireEvent.changeText(
      screen.getByLabelText('Nouveau mot de passe'),
      password,
    );
    fireEvent.changeText(
      screen.getByLabelText('Confirmer le mot de passe'),
      confirmation,
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Enregistrer et continuer' }),
    );
  };

  it('004 US2-2 saves the password and goes to the current list with a welcome', async () => {
    const choosePassword = jest.fn(async (): Promise<Choose> => ok(pairing));
    await openChoose(choosePassword);

    choose('a brand new password');

    expect(
      await screen.findByText('Mot de passe enregistré. Bienvenue !'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Ma liste' })).toBeOnTheScreen();
    expect(choosePassword).toHaveBeenCalledWith(
      'https://courses.example.fr',
      'marie@example.org',
      'ABCD-EFGH-JKMN-PQRS',
      'a brand new password',
      'Pixel 8',
    );
  });

  it.each([
    ['short', 'short', 'Le mot de passe doit contenir au moins 12 caractères.'],
    [
      'x'.repeat(129),
      undefined,
      'Le mot de passe ne doit pas dépasser 128 caractères.',
    ],
    [
      'abcd-efgh-jkmn-pqrs',
      undefined,
      'Choisissez un mot de passe différent du mot de passe temporaire.',
    ],
    [
      'a brand new password',
      'another one entirely',
      'Les deux mots de passe ne sont pas identiques.',
    ],
  ])(
    '004 US2-3 refuses "%s" with "%s"… without any request',
    async (password, confirmation, message) => {
      const choosePassword = jest.fn(async (): Promise<Choose> => ok(pairing));
      await openChoose(choosePassword);

      choose(password, confirmation ?? password);

      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(choosePassword).not.toHaveBeenCalled();
    },
  );

  it('004 R4 says the temporary password is no longer valid and offers "Retour"', async () => {
    await openChoose(async () => err({ type: 'InvalidCredentials' }));

    choose('a brand new password');

    expect(
      await screen.findByText(
        "Ce mot de passe temporaire n'est plus valable. Reconnectez-vous ou choisissez « Mot de passe oublié ? ».",
      ),
    ).toBeOnTheScreen();
    fireEvent.press(
      screen.getAllByRole('button', { name: 'Retour' }).slice(-1)[0] as never,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('header', { name: 'Se connecter' }),
      ).toBeOnTheScreen(),
    );
  });
});

describe('ForgotPasswordDialog', () => {
  type Reset = Awaited<ReturnType<AccountServer['requestPasswordReset']>>;

  const openDialog = async (
    requestPasswordReset: AccountServer['requestPasswordReset'],
  ) => {
    await renderSignIn({ requestPasswordReset });
    fill('courses.example.fr', 'Marie@Example.org', '');
    fireEvent.press(
      screen.getByRole('button', { name: 'Mot de passe oublié ?' }),
    );
    await screen.findAllByRole('header', { name: 'Mot de passe oublié' });
  };
  // The dialog's field comes after the form's in the tree.
  const emailField = () => screen.getAllByLabelText('Adresse e-mail').at(-1);
  const send = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));

  it('004 US4-1 shows the text of the dialog, with the email prefilled from SignIn', async () => {
    await openDialog(async () => ok(undefined));

    expect(
      screen.getByText(
        'Saisissez votre adresse e-mail. Si un compte existe, vous recevrez un mot de passe temporaire.',
      ),
    ).toBeOnTheScreen();
    expect(emailField()?.props.value).toBe('Marie@Example.org');
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
  });

  it('004 US4-1 sends the request and says an email was sent if an account exists', async () => {
    const reset = jest.fn(async (): Promise<Reset> => ok(undefined));
    await openDialog(reset);

    send();

    expect(
      await screen.findByText(
        "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.",
      ),
    ).toBeOnTheScreen();
    expect(reset).toHaveBeenCalledWith(
      'https://courses.example.fr',
      'marie@example.org',
    );
  });

  it.each([
    [err({ type: 'InvalidEmail' }), 'Saisissez une adresse e-mail valide.'],
    [
      err({ type: 'TooManyAttempts', minutesToWait: 42 }),
      'Trop de demandes. Réessayez dans 42 minutes.',
    ],
    [
      err({ type: 'ServerUnreachable' }),
      "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.",
    ],
  ] as [Reset, string][])(
    '004 US4-4 shows "%#" and keeps the dialog open',
    async (result, message) => {
      await openDialog(async () => result);

      send();

      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Envoyer' })).toBeOnTheScreen();
    },
  );

  it('004 US4-3 closes with "Annuler" and keeps what was typed in SignIn', async () => {
    await openDialog(async () => ok(undefined));

    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() =>
      expect(
        screen.queryAllByRole('header', { name: 'Mot de passe oublié' }),
      ).toHaveLength(0),
    );
    expect(screen.getByLabelText('Adresse du serveur').props.value).toBe(
      'courses.example.fr',
    );
  });

  describe('default server address (EXPO_PUBLIC_DEFAULT_SERVER_URL)', () => {
    const original = process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL;
    afterEach(() => {
      if (original === undefined) {
        delete process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL;
      } else {
        process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL = original;
      }
    });

    it('pre-fills the build address, without its scheme, when none was used before', async () => {
      process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL =
        'https://staging.courses.example.fr';

      await renderSignIn();

      expect(screen.getByLabelText('Adresse du serveur').props.value).toBe(
        'staging.courses.example.fr',
      );
    });

    it('keeps the last address ahead of the build address', async () => {
      process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL =
        'https://staging.courses.example.fr';

      await renderWithStore(
        <Navigation errorReporter={new RecordingErrorReporter()} />,
        {
          seed: fixture,
          asScreen: false,
          syncServer: reachable,
          connected: {
            serverUrl: 'https://courses.example.fr',
            lastSyncAt: null,
            withoutCredential: true,
          },
        },
      );
      await screen.findByText('Ma liste');
      fireEvent.press(
        await screen.findByRole('button', { name: 'Se reconnecter' }),
      );
      await screen.findByRole('header', { name: 'Se connecter' });

      expect(screen.getByLabelText('Adresse du serveur').props.value).toBe(
        'courses.example.fr',
      );
    });

    it('pre-fills nothing when there is neither', async () => {
      delete process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL;

      await renderSignIn();

      expect(screen.getByLabelText('Adresse du serveur').props.value).toBe('');
    });
  });
});

describe('SignIn in the mockup look', () => {
  it('draws "Se connecter" as the brand button, 50 dp high, 10 dp under the fields', async () => {
    await renderSignIn();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toHaveStyle({
      backgroundColor: lightTheme.colors.primaryContainer,
      borderRadius: 9999,
      height: 50,
      marginTop: 10,
    });
  });

  it('puts each field on the screen outline, with 16 dp corners', async () => {
    await renderSignIn();
    const outline = screen
      .UNSAFE_getAllByProps({ label: 'Adresse e-mail' })
      .map((node) => node.props)
      .filter((props) => 'outlineStyle' in props)[0];
    expect(outline).toMatchObject({
      outlineStyle: { borderRadius: 16, borderWidth: 1.5 },
    });
  });

  it('keeps the label of every field in its top border, even when empty', async () => {
    await renderSignIn();
    const outlines = screen
      .UNSAFE_getAllByProps({ label: 'Mot de passe' })
      .filter((node) => 'labelFloated' in node.props);
    expect(outlines[0]?.props.labelFloated).toBe(true);
  });

  it('draws the brand once, as the image, with no title under the tile (mockup 4)', async () => {
    await renderSignIn();
    expect(
      screen.getByRole('image', { name: 'Mes Courses' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Mes Courses')).not.toBeOnTheScreen();
  });

  it('keeps the screen name a heading that is not drawn, as the mockup has no app bar', async () => {
    await renderSignIn();
    expect(screen.getByRole('header', { name: 'Se connecter' })).toHaveStyle({
      opacity: 0,
    });
  });
});
