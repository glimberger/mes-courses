# Contract: Screens and User-Facing Text

Changes to the screens of [003](../../003-server-sync/contracts/ui-screens.md) for this feature.
UI tests assert this text exactly (Principles II and X). Components come from React Native Paper or
the shared module `apps/mobile/src/adapters/ui/components/` (Principle V). Every screen below
handles loading, empty and failure states (FR-019, Principle IX).

## Navigation

```text
CurrentList
 ├─ Lists
 ├─ AddArticles ─ CreateArticle, EditArticle
 └─ Settings
     ├─ SignIn                     (was ConnectServer)
     │   ├─ ChoosePassword         (first sign-in, or after a reset)
     │   └─ ForgotPasswordDialog
     ├─ Accounts                   (administrators only)
     │   └─ InviteAccountDialog, AccountActionDialogs
     └─ dialogs: ChangePassword, SignOut, DeleteMyAccount, SignedOutNotice
```

`PairingCodeDialog` and `ConnectServerScreen` are removed. After a sign-out or a deletion the app
navigates to SignIn as a full-screen route; its back button leads to the app in local-only mode
(research R11).

## SyncStatusBar (changed)

003's table applies, except the two connection rows:

| `sync.connection` | Icon | Text |
|---|---|---|
| `signedOut`, reason `revoked` | cloud-off | "Cet appareil n'est plus autorisé. Reconnectez-vous." + button "Se reconnecter" |
| `signedOut`, reason `accountDeleted` | cloud-off | "Ce compte a été supprimé." + button "Se connecter" |
| `suspended` | pause-circle | "Votre compte est suspendu. Vos listes restent sur cet appareil." |

`suspended` is not an error color: the user can still use the app (Principle VII). The buttons open
SignIn. When the user first sees a `signedOut` state, the `SignedOutNotice` dialog explains it (below);
dismissing it erases the local copy (research R11).

## SignedOutNotice (new dialog)

| Reason | Title | Body | Button |
|---|---|---|---|
| `revoked` | "Appareil déconnecté" | "Cet appareil a été retiré de votre compte. Les listes de ce compte vont être effacées de cet appareil." | "Compris" |
| `accountDeleted` | "Compte supprimé" | "Ce compte a été supprimé. Les listes de ce compte vont être effacées de cet appareil." | "Compris" |

When changes are still waiting to be sent, the body adds a second paragraph: "{n} modification(s)
n'ont pas pu être envoyées et seront perdues." (research R11). The device cannot send them any more,
so there is no other choice than "Compris".

It also covers a phone restored from a backup (FR-018b) with the `revoked` text. (US5-4, US6-5,
FR-017)

## Settings (changed)

**Not signed in**: "Connectez-vous pour retrouver vos listes sur vos autres appareils." and the
button "Se connecter", which opens SignIn.

**Signed in**:

| Section | Content |
|---|---|
| Compte | The email address; "Administrateur" under it for an administrator; buttons "Changer de mot de passe", "Gérer les comptes" (administrators only) |
| Serveur | As 003: address, "Dernière synchronisation : …", "Synchroniser maintenant". No "Modifier l'adresse": to use another server, sign out, then sign in |
| Appareils | As 003, only the caller's devices. No "Ajouter un appareil": a new device signs in |
| Actions | "Se déconnecter de cet appareil", "Supprimer mon compte" |

| Region | States |
|---|---|
| Compte | loading `LoadingState`; offline: the email is not shown and "Compte indisponible hors connexion." appears without error color; error "Impossible de charger le compte." + "Réessayer"; success |
| Appareils | as in 003 |

## SignIn (replaces ConnectServer)

Appbar title "Se connecter".

- Field "Adresse du serveur" (placeholder "courses.example.fr"; `https://` is added when omitted;
  `http://` is refused). Prefilled with the last address used.
- Field "Adresse e-mail" (keyboard type email, no autocorrect).
- Field "Mot de passe" (hidden, with a "Afficher le mot de passe" toggle).
- Field "Nom de cet appareil", prefilled with the device model, at most 60 characters.
- Button "Se connecter"; text button "Mot de passe oublié ?".

| Outcome | Shown |
|---|---|
| Signed in | Back to Settings, snackbar "Connecté. Synchronisation en cours…" |
| Temporary password accepted | Goes to ChoosePassword |
| `InvalidUrl` | "Saisissez une adresse comme courses.example.fr." |
| `InvalidEmail` | "Saisissez une adresse e-mail valide." |
| `InvalidCredentials` | "Adresse e-mail ou mot de passe incorrect." (never says which, US2-4) |
| `TemporaryPasswordExpired` | "Ce mot de passe temporaire a expiré. Choisissez « Mot de passe oublié ? » pour en recevoir un nouveau." (US2-5) |
| `AccountSuspended` | "Ce compte est suspendu. Contactez l'administrateur du serveur." |
| `TooManyAttempts` | "Trop d'essais. Réessayez dans {n} minutes." |
| `ServerUnreachable` | "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion." |
| `UntrustedServer` | "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur." (reported once) |
| `UpdateRequired` | The app's existing "Mettez à jour l'application" screen |

## ChoosePassword (new screen)

Appbar title "Choisir votre mot de passe". Text: "Choisissez un mot de passe d'au moins 12
caractères. Il remplace le mot de passe temporaire." Fields "Nouveau mot de passe" and "Confirmer le
mot de passe". Button "Enregistrer et continuer". Back returns to SignIn and keeps nothing.

| Outcome | Shown |
|---|---|
| Success | To the current list, snackbar "Mot de passe enregistré. Bienvenue !" |
| `TooShort` | "Le mot de passe doit contenir au moins 12 caractères." |
| `TooLong` | "Le mot de passe ne doit pas dépasser 128 caractères." |
| `SameAsTemporary` | "Choisissez un mot de passe différent du mot de passe temporaire." |
| Entries differ | "Les deux mots de passe ne sont pas identiques." |
| `TemporaryPasswordInvalid` (replaced or used elsewhere since the sign-in) | "Ce mot de passe temporaire n'est plus valable. Reconnectez-vous ou choisissez « Mot de passe oublié ? »." with the button "Retour", which goes back to SignIn (research R4) |
| `TemporaryPasswordExpired` | The SignIn message, and the same "Retour" |
| Other failures | As in SignIn |

## ForgotPasswordDialog (new)

Title "Mot de passe oublié". Body "Saisissez votre adresse e-mail. Si un compte existe, vous recevrez un
mot de passe temporaire." Field "Adresse e-mail" (prefilled from SignIn), buttons "Annuler" and
"Envoyer".

| Outcome | Shown |
|---|---|
| Accepted (account or not) | "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé." (US4-1, US4-3: identical) |
| `InvalidEmail` | "Saisissez une adresse e-mail valide." |
| `TooManyAttempts` | "Trop de demandes. Réessayez dans {n} minutes." (US4-4) |
| `ServerUnreachable` | "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion." |

## Account dialogs (new)

| Dialog | Text | Outcomes |
|---|---|---|
| ChangePassword | Title "Changer de mot de passe"; fields "Mot de passe actuel", "Nouveau mot de passe", "Confirmer le mot de passe"; buttons "Annuler" and "Enregistrer" | success snackbar "Mot de passe modifié."; "Mot de passe actuel incorrect."; the password messages of ChoosePassword (except `SameAsTemporary`); `SameAsCurrent`: "Choisissez un mot de passe différent de l'actuel."; `TooManyAttempts` |
| SignOut | Title "Se déconnecter de cet appareil ?"; body "Vos listes seront effacées de cet appareil. Elles restent sur votre compte."; buttons "Annuler" and "Se déconnecter". With pending changes the body adds "{n} modification(s) n'ont pas encore été envoyées et seront perdues." and the button becomes "Se déconnecter quand même" (US6-4) | goes to SignIn |
| DeleteMyAccount | Title "Supprimer votre compte ?"; body "Votre compte et toutes vos listes seront supprimés du serveur, sans retour possible."; field "Mot de passe"; buttons "Annuler" and "Supprimer mon compte" (error color) | goes to SignIn; "Mot de passe incorrect."; for the only administrator: "Le seul administrateur ne peut pas supprimer son compte." (US6-7) |

Offline, the three actions that need the server show "Connexion au serveur nécessaire." and do
nothing else (changing the password and deleting the account); signing out offline works and says,
after confirming, nothing more: the device is only cleared locally (research R11).

## Accounts (new screen, administrators)

Appbar title "Comptes", action "Inviter". One row per account: the email, a state chip ("Actif",
"Invité, pas encore connecté", "Invitation expirée" when `invitationExpired`, "Suspendu") and
"Dernière synchronisation : …" ("Jamais" if none). Nothing else of the account is shown: no
lists, no devices (research R12). Row menu: "Suspendre" or "Réactiver", "Renvoyer les
identifiants" (invited and not suspended only), "Supprimer".

| Region | States |
|---|---|
| Accounts list | loading `LoadingState`; empty (only the administrator exists): `EmptyState` "Vous êtes le seul utilisateur." with the action "Inviter quelqu'un"; error "Impossible de charger les comptes." + "Réessayer" (offline: "Liste des comptes indisponible hors connexion."); success |

| Action | Text | Outcomes |
|---|---|---|
| InviteAccountDialog | Title "Inviter quelqu'un"; field "Adresse e-mail"; body "La personne recevra un e-mail avec un mot de passe temporaire."; buttons "Annuler" and "Inviter" | success snackbar "Invitation envoyée à {email}." (US1-1); "Cette adresse a déjà un compte." (US1-2); "Saisissez une adresse e-mail valide." (US1-3); "L'invitation n'a pas pu être envoyée. Réessayez." (US1-4) |
| Suspend | Title "Suspendre ce compte ?"; body "{email} ne pourra plus synchroniser. Ses données sont conservées."; "Annuler" / "Suspendre" | "Le seul administrateur ne peut pas être suspendu." (US5-5) |
| Reactivate | no dialog; snackbar "Compte réactivé." | |
| Resend | Title "Renvoyer les identifiants ?"; body "Un nouveau mot de passe temporaire sera envoyé à {email}. L'ancien ne fonctionnera plus."; "Annuler" / "Renvoyer" | success snackbar "E-mail envoyé."; the invitation failure message (US5-6) |
| Delete | Title "Supprimer ce compte ?"; body "Le compte de {email} et toutes ses listes seront supprimés du serveur, sans retour possible."; "Annuler" / "Supprimer" (error color) | "Le seul administrateur ne peut pas être supprimé." |

## Emails

Plain text, sent by the server's mail adapter (research R8): the only French text on the server,
kept in `adapters/mail/` the way the app keeps its text in the UI adapter. Tests assert it
exactly.

**Invitation** (subject "Votre accès à Mes courses"):

```text
Bonjour,

Vous êtes invité(e) à utiliser Mes courses.

Adresse du serveur : {serverUrl}
Identifiant : {email}
Mot de passe temporaire : {XXXX-XXXX-XXXX-XXXX}

Ouvrez l'application, choisissez « Se connecter », puis saisissez ces informations. Vous
choisirez ensuite votre propre mot de passe. Le mot de passe temporaire est valable jusqu'au
{date}.
```

**New temporary password** (subject "Votre nouveau mot de passe temporaire"):

```text
Bonjour,

Voici un nouveau mot de passe temporaire pour Mes courses : {XXXX-XXXX-XXXX-XXXX}
Il est valable jusqu'au {date}.

Votre mot de passe actuel fonctionne toujours tant que vous n'utilisez pas celui-ci. Si vous n'avez
rien demandé, ignorez ce message.
```

## Error reports (Principle VIII)

Contexts used: `{ operation: 'sync' | 'signIn' | 'choosePassword' | 'requestPasswordReset' |
'changePassword' | 'deleteAccount' | 'signOut' | 'listAccounts' | 'inviteAccount' |
'suspendAccount' | 'deleteAccountAsAdmin' | 'resendCredentials', screen?: 'Settings' | 'SignIn' |
'ChoosePassword' | 'Accounts' }`. They never contain an address, a password, a temporary password,
a server URL or a device name; the user identifier is the opaque `accountId`.

## Stories and end-to-end journeys

Additions to 003's list. Stories build the `sync` slice through the real use cases on the in-memory
`SyncServer`, `AccountServer`, `AdminServer` and `CredentialStore` fakes.

| Story id | Shows | Scenarios |
|---|---|---|
| `Components/SyncStatusBar/SignedOutRevoked`, `.../SignedOutAccountDeleted`, `.../Suspended` | the three new rows (`SignedOutRevoked` also from a connection with no credential) | US5-2, US5-4, US6-5 |
| `Dialogs/SignedOutNotice/Revoked`, `.../AccountDeleted`, `.../PendingChangesLost` | the two messages, and the lost-changes paragraph | US5-4, US6-5 |
| `Screens/Settings/NotSignedIn`, `.../SignedIn`, `.../SignedInAdministrator`, `.../AccountLoading`, `.../AccountError`, `.../AccountOffline` | account section states | US6-1 |
| `Screens/SignIn/Default`, `.../InvalidCredentials`, `.../TemporaryPasswordExpired`, `.../AccountSuspended`, `.../TooManyAttempts`, `.../ServerUnreachable`, `.../UntrustedServer` | the outcome messages | US2-4, US2-5 |
| `Screens/ChoosePassword/Default`, `.../TooShort`, `.../NotIdentical`, `.../SameAsTemporary`, `.../TemporaryPasswordInvalid` | the form and its errors | US2-1, US2-3 |
| `Dialogs/ForgotPasswordDialog/Default`, `.../Sent`, `.../TooManyAttempts` | the dialog states | US4-1, US4-4 |
| `Dialogs/ChangePasswordDialog/Default`, `.../WrongCurrent`, `.../SameAsCurrent`, `Dialogs/SignOutDialog/Default`, `.../PendingChanges`, `Dialogs/DeleteMyAccountDialog/Default`, `.../WrongPassword`, `.../LastAdministrator` | the account dialogs | US6-2, US6-4, US6-6, US6-7 |
| `Screens/Accounts/Loading`, `.../Error`, `.../Offline`, `.../Empty`, `.../Success` | the list states, with the three account states and an expired invitation in `Success` | US5-1 |
| `Dialogs/InviteAccountDialog/Default`, `.../AlreadyExists`, `.../InvalidEmail`, `.../MailFailed` | the invitation outcomes | US1-2, US1-3, US1-4 |
| `Dialogs/SuspendAccountDialog/Default`, `.../LastAdministrator`, `Dialogs/DeleteAccountDialog/Default`, `.../LastAdministrator`, `Dialogs/ResendCredentialsDialog/Default` | the administration dialogs | US5-2, US5-4, US5-5, US5-6 |

Removed stories: every `Screens/ConnectServer/*` and `Dialogs/PairingCodeDialog/*`, and the `DisconnectedByServer` bar story, replaced by the above.

| File | Journey | Scenarios |
|---|---|---|
| `sync-unreachable.e2e.ts` (changed) | On a fresh install, no sync bar is shown; "Réglages" shows "Se connecter". In SignIn, enter `127.0.0.1:9` (nothing listens there on the device, and no DNS query leaves it), any address and any password: "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion." Back on the current list, add and tick an item: it works at once. | 003 US4-1, US4-6, FR-002 |

No journey signs in against a real server: that needs a trusted TLS certificate on the emulator
(003 FR-019). Sign-in is covered by `tests/sync/` and the quickstart's Pi pass.
