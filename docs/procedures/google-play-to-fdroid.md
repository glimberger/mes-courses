# Android: from Google Play to F-Droid

Android users get the app from the production F-Droid repository, served by the Pi, instead of
Google Play ([005 continuous delivery](../../specs/005-continuous-delivery/spec.md), FR-026).

Order of events for the maintainer:

1. The first production F-Droid release is delivered.
2. The guide below is sent to every Android user.
3. No more Google Play builds are made. `minAppVersion` stays at or below the last Google Play
   build until everyone has migrated.

`.github/scripts/repo-address.sh production` prints the repository address with its fingerprint
and its QR code (`SERVER_URL` and `FDROID_FINGERPRINT` set, see the script header).

## Passer de Google Play à F-Droid

Prévoyez environ 10 minutes. Vos listes, articles et catégories restent sur le serveur : il
suffit de les retrouver en vous reconnectant.

1. Ouvrez les **Réglages** de l'application et vérifiez qu'aucune modification n'est en attente,
   puis lancez une dernière synchronisation.
   **Ne désinstallez pas tant que la synchronisation ne peut pas aboutir** (serveur injoignable,
   erreurs) : les modifications non synchronisées seraient perdues avec l'application.
2. Désinstallez l'application installée depuis Google Play. Il faut le faire : les deux
   installations sont signées différemment, Android refuse de mettre l'une à jour par l'autre.
   La copie locale des données est effacée.
3. Installez [F-Droid](https://f-droid.org) ou [Droid-ify](https://github.com/Droid-ify/client).
4. Ajoutez le dépôt de production dans _Dépôts › +_, en scannant le QR code ou en ouvrant le lien
   que vous avez reçu. N'ajoutez jamais l'adresse du dépôt sans son empreinte (le paramètre
   `fingerprint`) : c'est elle qui prouve que le dépôt est le bon.
5. Installez « Mes courses ».
6. Connectez-vous et vérifiez que vos listes, articles et catégories sont revenus.

Les réglages enregistrés uniquement sur l'appareil ne sont pas conservés : il faudra les refaire.
