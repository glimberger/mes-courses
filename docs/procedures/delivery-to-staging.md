# Delivery to staging

Every merge to `main` whose `CI` run is green starts `Deliver staging`. It builds only what the
merge changed (the server, the Android app), signs a manifest, and publishes it to the `channel-staging`
release. The agent checks that channel every few minutes, verifies the signature, and deploys:
it stops the instance, copies the database, switches to the new release, starts it on a private
validation port, checks that `/v1/health` reports the expected commit, and only then opens the
public port. The Android build appears in the staging F-Droid repository as "Mes courses (test)".
The run summary lists every job and its outcome, and `main.js status` on the Pi shows what each
instance runs.
