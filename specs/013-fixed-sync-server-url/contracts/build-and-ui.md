# Contract: Build variable and UI changes

## Build variable

| Variable | Required | Rule |
| --- | --- | --- |
| `EXPO_PUBLIC_DEFAULT_SERVER_URL` | yes (all builds that run the app) | non-blank, valid host; `https://` assumed when no scheme; `http://` only if `__DEV__` and `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1` |

Failure: app start-up rejects with `ServerUrlNotConfigured`; CI workflow `android-apk.yml` fails at its first step with `::error::`. Both messages name the variable.

## Screens

| Screen | After |
| --- | --- |
| SignIn | Fields: "Adresse e-mail", "Mot de passe", "Nom de cet appareil". No "Adresse du serveur"; message for `InvalidUrl` removed. Other outcome messages unchanged. |
| ChoosePassword | Route params lose `url`. |
| ForgotPasswordDialog | Prop `address` removed. |
| Settings, "Serveur" section | Row shows "Dernière synchronisation : …" (no address); "Synchroniser maintenant" unchanged. |

## Application API

`signIn(email, password, deviceName)`, `chooseInitialPassword(email, temporaryPassword, newPassword, confirmation, deviceName)`, `requestPasswordReset(email)`; `changeServerUrl` removed from use cases and the store.
