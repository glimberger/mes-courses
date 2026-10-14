import { renderMail } from './templates';

const EXPIRES = '2026-10-19T10:00:00.000Z';

describe('renderMail', () => {
  it('004 US1-1 the invitation carries the server address, the sign-in name, the temporary password and the expiry date', () => {
    expect(
      renderMail({
        kind: 'invitation',
        to: 'marie@example.org',
        temporaryPassword: 'ABCD-EFGH-JKMN-PQRS',
        expiresAt: EXPIRES,
        serverUrl: 'https://courses.example.fr',
      }),
    ).toEqual({
      to: 'marie@example.org',
      subject: 'Votre accès à Mes courses',
      text: `Bonjour,

Vous êtes invité(e) à utiliser Mes courses.

Adresse du serveur : https://courses.example.fr
Identifiant : marie@example.org
Mot de passe temporaire : ABCD-EFGH-JKMN-PQRS

Ouvrez l'application, choisissez « Se connecter », puis saisissez ces informations. Vous
choisirez ensuite votre propre mot de passe. Le mot de passe temporaire est valable jusqu'au
19 octobre 2026.
`,
    });
  });

  it('004 US4-1 the reset message has no server address and says the current password still works', () => {
    expect(
      renderMail({
        kind: 'newTemporaryPassword',
        to: 'marie@example.org',
        temporaryPassword: 'ABCD-EFGH-JKMN-PQRS',
        expiresAt: EXPIRES,
      }),
    ).toEqual({
      to: 'marie@example.org',
      subject: 'Votre nouveau mot de passe temporaire',
      text: `Bonjour,

Voici un nouveau mot de passe temporaire pour Mes courses : ABCD-EFGH-JKMN-PQRS
Il est valable jusqu'au 19 octobre 2026.

Votre mot de passe actuel fonctionne toujours tant que vous n'utilisez pas celui-ci. Si vous n'avez
rien demandé, ignorez ce message.
`,
    });
  });

  it('004 names the expiry day in Paris time, so a late evening instant keeps its local date', () => {
    const { text } = renderMail({
      kind: 'newTemporaryPassword',
      to: 'a@b.fr',
      temporaryPassword: 'X',
      expiresAt: '2026-10-19T23:30:00.000Z',
    });
    expect(text).toContain("jusqu'au 20 octobre 2026.");
  });
});
