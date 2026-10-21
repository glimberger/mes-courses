# Losing or exposing a signing key

Each key has an offline backup, kept with its passwords in the password manager, and a procedure.

**APK upload key** (FR-022). Android refuses to update an app signed with another key, so the key
is the identity of the app.

- _Lost_, with the backup intact: restore it from the backup and set the four `ANDROID_*` secrets
  again. Nothing else changes.
- _Lost with no backup, or compromised_: the installed apps cannot be updated by a build signed
  with a new key. Create a new key, set the secrets and `ANDROID_CERT_SHA256`, release, and every
  Android user uninstalls and reinstalls as in "Passer de Google Play à F-Droid" below (their
  data is on the server, after a last sync). If it was compromised, delete the old key's secrets
  from GitHub first and check the releases for builds you did not make.

**F-Droid repository key** (FR-023). The clients pin the repository by the fingerprint of this key.

- _Lost_, with the backup intact: restore it and set the three `FDROID_*` secrets again.
- _Lost with no backup, or compromised_: create a new key, set the secrets, release, and send
  every user the new address with its new fingerprint from `.github/scripts/repo-address.sh`.
  Users remove the old repository and add the new one. Apps already installed keep working and
  update from the new repository, since the APK key did not change.

**Manifest signing key**. Replace the public key in `deploy/allowed_signers`, set
`DEPLOY_SIGNING_KEY`, release, and update the agent on the Pi **before** relying on the new
key: an agent holding the old public key rejects the new manifests.
