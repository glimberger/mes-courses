import type { MailMessage } from '../../application/ports/mailer';

export type RenderedMail = { to: string; subject: string; text: string };

const formatDate = (instant: string): string =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(instant));

/**
 * The plain-text French messages (contracts/ui-screens.md, "Emails"). The only French text on the
 * server: Principle X lets a message-delivering adapter hold it.
 */
export const renderMail = (message: MailMessage): RenderedMail => {
  const until = formatDate(message.expiresAt);
  switch (message.kind) {
    case 'invitation':
      return {
        to: message.to,
        subject: 'Votre accès à Mes courses',
        text: `Bonjour,

Vous êtes invité(e) à utiliser Mes courses.

Adresse du serveur : ${message.serverUrl}
Identifiant : ${message.to}
Mot de passe temporaire : ${message.temporaryPassword}

Ouvrez l'application, choisissez « Se connecter », puis saisissez ces informations. Vous
choisirez ensuite votre propre mot de passe. Le mot de passe temporaire est valable jusqu'au
${until}.
`,
      };
    case 'newTemporaryPassword':
      return {
        to: message.to,
        subject: 'Votre nouveau mot de passe temporaire',
        text: `Bonjour,

Voici un nouveau mot de passe temporaire pour Mes courses : ${message.temporaryPassword}
Il est valable jusqu'au ${until}.

Votre mot de passe actuel fonctionne toujours tant que vous n'utilisez pas celui-ci. Si vous n'avez
rien demandé, ignorez ce message.
`,
      };
  }
};
