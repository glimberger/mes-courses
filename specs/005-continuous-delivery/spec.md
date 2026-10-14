# Feature Specification: Continuous Delivery to Staging and Production

**Feature Branch**: `feat/005-continuous-delivery`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "je veux mettre en place un workflow de continuous delivery pour le staging et production. Périmètre app + serveur ; staging serveur = 2e instance sur le Pi ; le Pi tire les déploiements lui-même : pas de port entrant, pas de clé SSH dans GitHub ; build staging à chaque push sur main qui touche l'app ; Android sort d'EAS et de Google Play : APK buildé et signé dans GitHub Actions, distribué par un dépôt F-Droid auto-hébergé sur le Pi (client F-Droid ou Droid-ify sur le téléphone) ; iOS garde EAS Build + Submit (TestFlight pour la prod, distribution interne ad hoc pour le staging)."

## Context

Today every delivery is manual (README "Releases", "On the Pi"): the maintainer runs
`eas build` and `eas submit` from their machine for both platforms, and deploys the server by
logging in to the Pi, pulling, building and restarting the service. There is a single server
instance, which serves real users, so nothing can be tried against a server before it reaches
them. Android builds go to users through Google Play's internal testing track.

This feature makes delivery automatic and adds a staging environment that every change to the
default branch reaches first. Production is reached only by an explicit release decision of the
maintainer. Delivery spans the mobile app (Android and iOS) and the sync server.

The constraints the maintainer set are part of the requirement, not implementation choices:

- the staging server is a second instance on the same Raspberry Pi as production;
- the Pi fetches its deployments itself: it opens no new inbound port, and GitHub holds no
  credential that can log in to the Pi;
- Android leaves EAS and Google Play: the APK is built and signed in GitHub Actions and
  distributed by a self-hosted F-Droid repository on the Pi, which the phones follow with an
  F-Droid client (F-Droid or Droid-ify);
- iOS keeps EAS Build and EAS Submit: TestFlight for production, EAS internal (ad hoc)
  distribution for staging.

## Clarifications

### Session 2026-10-14

- Q: What is the release action that delivers to production? → A: Pushing a version tag
  `vX.Y.Z` on a commit of the default branch. The tag is checked against the version in the app
  configuration of that commit.
- Q: How are writes sent by phones during the health-check window handled when the database
  copy is restored? → A: They cannot exist: a new version is reachable by phones only after it
  passed its health check. Until then, phones see an unreachable server (a normal state).
- Q: What does the Pi do when the previous version also fails its health check after a
  rollback? → A: It leaves the previous version in service, never a stopped instance, and
  reports a critical error; systemd keeps restarting it.
- Q: How is the maintainer told of a failed deployment on staging? → A: By email, through an
  alert on the delivery agent's error reports in every environment; other staging errors send
  no email.
- Q: Is the unsigned, root-only local deployment (`deploy-file`) an accepted exception to
  FR-017? → A: Yes, as a documented exception: only a local deployment started by hand by root
  on the Pi skips the verification.
- Q: What happens to a release whose production server turns healthy only after the release run
  stopped waiting? → A: The release is partial (Android published, iOS not submitted); the
  maintainer completes it by re-running the failed jobs of the same run, on the same commit.
- Q: How is an iOS build started with `--no-wait` recorded, given GitHub only knows it was
  queued? → A: The run records "queued on EAS" with the EAS link; the build's own result is
  followed in EAS (its email), and a refusal at queue time fails the iOS target of the run.
- Q: How does the maintainer ship the fix after a production rollback? → A: By a new pull
  request, a higher version and a new tag; a tag whose release failed is never reused.
- Q: Does an app-only release publish the F-Droid repository when its carried-over server commit
  is one that failed? → A: Yes: a failed server commit is ignored like an unchanged server, and
  the repository is published if the server now in service is healthy.
- Q: Must one agent pass be bounded so a slow staging cannot delay production? → A: Yes: every
  download and runtime build has its own time limit; past it the step fails, is reported, and
  the next instance is handled.
- Q: Must the Expo credential held by GitHub be limited to this project? → A: No: the scope of
  an Expo robot user is the account, which holds only this project; FR-028 is worded on what it
  cannot do (billing, members, App Store credentials).
- Q: Must the Pi detect and report that the deployment agent itself stopped running? → A: Yes:
  each pass checks in, and no pass for 30 minutes emails the maintainer.
- Q: Who may reach the F-Droid repositories? → A: Anyone who knows the address; both are public
  URLs served by the Pi. The address is unlisted and the APK of an invite-only app is unusable
  without an account, so the exposure is accepted (Assumptions).
- Q: What happens to Android users who do not leave Google Play? → A: Their install keeps
  working and syncing. The maintainer tells every Android user directly when the guide is
  published, and does not raise `minAppVersion` above the last Google Play build before the
  migration is done.
- Q: What happens when the EAS build allowance runs out? → A: The iOS staging build fails when
  queued and is never replaced silently (no batching, no fallback); the run shows it (FR-030).
  The expected load is one iOS staging build per merged app change.
- Q: How do production iOS users receive the TestFlight build? → A: As TestFlight internal
  testers (invited in App Store Connect), who get the build without a beta review; external
  testing is out of scope while the app reaches only the maintainer's circle.

## User Scenarios & Testing *(mandatory)*

The actors are the **maintainer**, who merges pull requests, decides releases and runs the Pi,
and the **users**, the invited people (004) who use the app on their phones.

### User Story 1 - Every merged change reaches staging on its own (Priority: P1)

The maintainer merges a pull request that changes the app, the server or a shared package. Without
any further action, the staging server on the Pi runs the new version, and a new staging build of
the app becomes available on the maintainer's Android phone (through the F-Droid client) and on
their iPhone (through EAS internal distribution). The maintainer tries the change against the
staging server, with staging data, before any user sees it.

**Why this priority**: staging is the base every other story builds on, and it removes the
manual server deployment and manual builds after every merge.

**Independent Test**: merge a change that alters a visible label and a server response; within
the target delay, the staging server answers with the new version, and the F-Droid client and the
iPhone offer the new staging build, which shows the new label.

**Acceptance Scenarios**:

1. **Given** a pull request changing the server is merged, **When** CI is green on the merge
   commit, **Then** the staging server runs that commit without anyone logging in to the Pi, and
   reports that commit as its version.
2. **Given** a pull request changing the app is merged, **When** CI is green on the merge commit,
   **Then** a signed Android staging build of that commit is published in the staging F-Droid
   repository, and an iOS staging build of that commit is available for installation on the
   registered iPhone.
3. **Given** a documentation-only pull request is merged (per `.github/scripts/app-changed.sh`),
   **When** it lands on the default branch, **Then** no staging build or deployment starts.
4. **Given** a pull request changing only the server is merged, **When** it lands, **Then** the
   staging server is deployed and no new app build starts; a pull request changing only the app
   builds the app and leaves the staging server as it is.
5. **Given** CI fails on the merge commit, **When** the run ends, **Then** nothing is delivered
   to staging and the previous staging version keeps running.
6. **Given** the staging app is installed on a phone that also has the production app, **When**
   both are opened, **Then** they coexist as two distinct apps, with distinct names and icons,
   and their local data are separate.

---

### User Story 2 - The maintainer releases to production (Priority: P1)

Once a version is validated on staging, the maintainer takes one explicit release action. The
production server on the Pi is updated, the Android production build is published in the
production F-Droid repository, from which the users' phones are offered the update, and the iOS
production build is submitted to TestFlight.

**Why this priority**: it is the delivery users actually receive; it replaces the manual
`eas build`, `eas submit` and Pi deployment of the README's release steps.

**Independent Test**: take the release action on a validated commit; the production server
reports the new version, a phone following the production F-Droid repository is offered the new
version, and TestFlight shows the new build.

**Acceptance Scenarios**:

1. **Given** a commit of the default branch is validated on staging, **When** the maintainer
   pushes the version tag on it, **Then** the production server, the production Android
   build and the production iOS build are all made from that same commit.
2. **Given** a release is triggered, **When** it runs, **Then** the production server is
   updated before the new app builds are offered to users, so an updated app never meets an
   older server.
3. **Given** the version tag names a version, **When** that version differs from the app
   version set in the app configuration of that commit, **Then** the release stops before
   delivering anything and says which version is expected.
4. **Given** the Android device suite is not green on the release commit, **When** the
   maintainer takes the release action, **Then** the release stops before delivering anything
   and says why.
5. **Given** no release action is taken, **When** any number of changes are merged, **Then**
   production stays exactly as it is.
6. **Given** a user's phone follows the production F-Droid repository, **When** a new version
   is published there, **Then** the F-Droid client offers the update and installing it keeps the
   user's lists and session.

---

### User Story 3 - A failed server deployment does not take the server down (Priority: P1)

A new server version fails to start on the Pi, or does not answer its health check after
starting. The Pi puts back the version that ran before, with its data as they were before the
deployment, and the maintainer is told.

**Why this priority**: production holds the users' data (constitution VII); an unattended
deployment must never leave it down or with its data half-migrated.

**Independent Test**: deliver a server build that exits at startup to staging; the staging
instance comes back on its previous version with its previous data, and the maintainer receives
the failure notice.

**Acceptance Scenarios**:

1. **Given** a new version is delivered to an instance, **When** it is installed, **Then** a
   copy of that instance's database is taken before the new version first starts.
2. **Given** the new version does not pass its health check within the allowed delay, **When**
   the delay expires, **Then** the instance runs its previous version on the database copy taken
   before the deployment, and the maintainer is notified with the failed version.
   Phones reach neither the failed version nor any state of the database that is later
   discarded.
3. **Given** a version failed on an instance, **When** the Pi checks for deployments again,
   **Then** it does not retry that same version, until a newer one is delivered.
4. **Given** a deployment fails on staging, **When** this happens, **Then** production is not
   affected in any way.

---

### User Story 4 - Android users move from Google Play to the F-Droid repository (Priority: P2)

A user who has the app from Google Play's internal testing track adds the production F-Droid
repository to an F-Droid client and installs the app from it, keeping their account and their
data, which are on the server.

**Why this priority**: it is a one-time migration per Android user, needed once Google Play
stops receiving builds, but the app keeps working on the old install meanwhile.

**Independent Test**: on a phone with the Google Play install and synced data, follow the
migration guide; after it, the app installed from the F-Droid repository shows the same lists
once signed in.

**Acceptance Scenarios**:

1. **Given** a user has the Google Play install, **When** they follow the migration guide,
   **Then** the guide makes them confirm everything is synchronized before removing the old
   install, because the two installs are signed differently and cannot update one another.
2. **Given** the user scans the repository's address (a link or a QR code) in the F-Droid
   client, **When** the repository is added, **Then** the client verifies it is the maintainer's
   repository and lists the app.
3. **Given** the migrated user signs in on the new install, **When** synchronization ends,
   **Then** their lists, articles and categories are all there.

---

### User Story 5 - The maintainer sees what runs where (Priority: P3)

The maintainer can tell at a glance which version runs on each server instance, which build is
the latest in each F-Droid repository and on each iOS channel, and the outcome of the latest
deployment of each.

**Why this priority**: useful for confidence and diagnosis, but delivery works without it.

**Independent Test**: after a staging deployment and a release, read the versions reported for
each environment and compare them with the commits that were delivered.

**Acceptance Scenarios**:

1. **Given** a server instance is running, **When** its version is requested, **Then** it
   answers with its release version (if any) and the commit it was built from.
2. **Given** a staging or production delivery ends, successful or not, **When** the maintainer
   looks at the repository's delivery runs, **Then** each run shows the commit, the environment,
   each target (server, Android, iOS) and its outcome.

### Edge Cases

- Two pull requests are merged a few minutes apart: staging ends on the later commit; an older
  delivery never replaces a newer one on the Pi or in a repository.
- The Pi is offline or rebooting when a staging or production version is published: it deploys
  the latest pending version when it is back, and skips the intermediate ones.
- The Pi cannot reach GitHub for a long time: both instances keep running their current version;
  nothing is lost and nothing restarts. After one hour without a successful fetch, the agent
  reports an error to the maintainer (FR-020).
- The Pi lacks the disk space for a deployment: the deployment fails before anything is stopped,
  counts as a failed version, and is reported with the free space found (FR-032).
- The agent's state file of an instance is missing or unreadable while a release runs: the agent
  leaves the running version untouched, reports an error, and rebuilds the state from the
  installed release, with no failed version remembered (FR-033).
- A release is triggered while a staging deployment is in progress on the Pi: the two instances
  are deployed one after the other, never in a way that one disturbs the other.
- A server version contains a database migration and fails after migrating: the database copy
  taken before the deployment is what the previous version runs on (US3).
- A version tag is pushed on a commit outside the default branch: the release is refused.
- The production server turns healthy only after the release run stopped waiting for it: the
  release run is failed and the release is partial (the Android build is published, the iOS
  build is not submitted). Re-running the failed jobs of the same run completes it on the same
  commit; no new tag is needed.
- A production release is rolled back by the Pi: the tag stays recorded as a failed release and
  is never reused; the fix is a new pull request with a higher version and a new tag.
- A slow or hanging step on one instance (a download, a runtime build) fails at its own time
  limit and never holds the other instance beyond it.
- The production release names a commit older than the one already in production: it is
  refused; a faulty release is fixed forward (README "Releases").
- The Android signing key is lost or compromised: the app can no longer be updated in place on
  the phones, or can no longer be trusted. The key has a documented offline backup. Without it,
  or after a compromise, a new key is made and every Android user reinstalls after a sync; the
  maintainer tells them directly (FR-022). The F-Droid repository key is handled the same way
  (FR-023): a new key means a new link, and users add the repository again.
- The iPhone that receives staging builds is not registered for internal distribution: the
  build cannot be installed on it; registering a device is a documented one-time step.
- The EAS build allowance is exhausted: the iOS staging build is refused when it is queued, so
  the run shows the iOS target failed, while the Android staging build and the server
  deployment still complete; nothing retries or batches it (Clarifications). A build that fails later, inside EAS, is reported by EAS (its
  email), not by the run.
- The same commit is delivered to staging twice (for example, a re-run): the second delivery is
  harmless and changes nothing.
- The staging app is pointed at the production server, or the reverse: it works as any app with
  that address would; the staging app only suggests the staging server address by default.

## Offline Behavior and Synchronization

This feature changes how the app and the server are delivered, not how they behave. The app stays
fully usable offline and while a server instance restarts during a deployment: a server restart
is handled exactly like an unreachable server (constitution VII), and pending changes are sent
once it answers again. Staging and production are two independent servers with independent data;
no data is synchronized between them, and an app install talks to one server only, the one it is
signed in to. Concurrent changes are reconciled as before (003, 004).

## Requirements *(mandatory)*

### Functional Requirements

**Environments**

- **FR-001**: There MUST be two environments, staging and production, each with its own server
  instance, its own database, its own public address and its own app builds.
- **FR-002**: Both server instances MUST run on the maintainer's Raspberry Pi, isolated from
  each other: separate data, separate configuration, separate service; stopping or breaking one
  MUST NOT affect the other.
- **FR-003**: The staging app MUST be installable next to the production app on the same phone,
  with a distinct app identity, a name and icon that mark it as staging, and separate local data.
  Concretely, on both platforms: the name is "Mes courses (test)" (production: "Mes courses");
  the icon carries a staging badge on the production art; the Android package and the iOS bundle
  identifier end in `.staging`; and, since the identity differs, no local storage or keychain
  group is shared.
- **FR-004**: Error reports MUST carry the environment they come from (staging or production),
  for the app and the server, so production alerts ignore staging (README "Sentry alerts").

**Staging delivery**

- **FR-005**: Every push to the default branch that is not documentation-only (per the
  repository's path rule) MUST start a staging delivery once CI is green on that commit.
- **FR-006**: A staging delivery MUST deploy the staging server only when the server, a package
  it depends on or its deployment files changed, and MUST build the app only when the app, a
  package it depends on or its build configuration changed.
- **FR-007**: The staging delivery MUST produce a signed Android APK of that commit and publish it
  in a staging F-Droid repository hosted on the Pi.
- **FR-008**: The staging delivery MUST produce an iOS build of that commit through EAS Build,
  distributed by EAS internal (ad hoc) distribution to the maintainer's registered devices.

**Production delivery**

- **FR-009**: Production MUST change only through an explicit release action by the maintainer,
  naming the commit and the version to release. The release action is pushing a version tag
  `vX.Y.Z` on a commit of the default branch; the tag names both the commit and the version.
- **FR-010**: A release MUST refuse to run unless the release commit is on the default branch,
  CI and the Android device suite are green on it, its version matches the app configuration,
  and it is newer than the version in production.
- **FR-011**: A release MUST deploy the production server first, and MUST publish the Android
  build in the production F-Droid repository and submit the iOS build to TestFlight only after
  the production server answers its health check on the new version.
- **FR-012**: The production server, Android and iOS builds of a release MUST all come from the
  same commit.
- **FR-013**: Every build of a release MUST be a `production` build, so the existing release
  guard (`apps/mobile/build-config/release-guard.cjs`) applies to it.

**Pulled deployments on the Pi**

- **FR-014**: The Pi MUST fetch and install new server versions itself, by checking for them
  periodically; no deployment may require an inbound connection to the Pi other than the HTTPS
  traffic it already serves.
- **FR-015**: GitHub (repository, secrets, workflows) MUST NOT hold any credential that grants
  access to the Pi (SSH key, password, tunnel token).
- **FR-016**: Any credential the Pi uses to fetch deployments MUST be read-only and limited to
  what it fetches.
- **FR-017**: The Pi MUST verify that a server version it fetched was produced by the
  repository's delivery workflow for the expected commit before installing it. The only
  exception is a local deployment started by hand by root on the Pi, which goes through the same
  deployment and rollback path without a signature.
- **FR-018**: The Pi MUST deploy at most one version at a time per instance, always the latest
  one published for that instance, and MUST ignore a version older than the one installed.
  "Older" is the position of the commit on the default branch (its number of ancestors): the
  later commit is the newer version.
- **FR-019**: Before a new version first starts, the Pi MUST copy the instance's database; when
  the new version fails to start or to pass its health check, the Pi MUST restore the previous
  version and that copy, and MUST NOT retry the failed version. The health check is a request to
  the instance's version endpoint (FR-029) that must report the expected commit, and the delay
  is 60 seconds for the new version and 60 seconds again for the restored one. A failure before
  the instance is stopped (download, checksum, unpacking) counts as a failed version too: it is
  reported and not retried.
- **FR-019a**: A new version MUST NOT receive requests from phones until it has passed its health
  check, so that no write accepted by a version that is then rolled back can be lost.
- **FR-019b**: The Pi MUST NOT leave an instance stopped on purpose. When the restored previous
  version does not pass its health check either, the Pi MUST leave it in service, keep the
  service manager restarting it, and report a critical error to the maintainer.
- **FR-020**: The outcome of every deployment on the Pi (success, rollback with its reason) MUST
  be reported to the maintainer, by the same channel as the server's error reports. A failed or
  rolled-back deployment MUST reach the maintainer by email in both environments; the alert is
  tied to the delivery agent's reports, so staging's other errors stay silent. The notice names
  the instance, the failed version (commit) and the reason, and reaches the maintainer as soon as
  the report is sent. A failure to fetch deployments that lasts more than one hour is reported
  the same way.
- **FR-020a**: The maintainer MUST be notified by email when the deployment agent has not
  completed a pass for 30 minutes, whatever the cause (timer disabled, crash, Pi down).

- **FR-032**: Before installing a version, the Pi MUST check it has enough free disk space for
  the release, its runtime and one more copy of the database, and MUST fail the deployment
  before stopping anything when it does not. The Pi MUST keep, for each instance, at least the
  running release, the previous one (the rollback target) and the database copy taken before the
  latest deployment, and MUST bound everything older so the disk cannot fill up; the exact
  counts are a plan choice.
- **FR-033**: When an instance's state file is missing or unreadable while a release is
  installed, the Pi MUST leave the running version in service, report an error, and rebuild the
  state from the installed release; it MUST NOT stop or redeploy the instance because of it.

**Android distribution**

- **FR-021**: The Android APKs MUST be built and signed in GitHub Actions, with no EAS Build
  and no Google Play involved.
- **FR-022**: The Android signing key MUST be stored only as a GitHub Actions secret and in an
  offline backup held by the maintainer; it MUST NOT appear in the repository or in build logs.
  Production and staging builds MAY share a key since their app identities differ. The loss and
  compromise procedure MUST be documented: a new key, a new install for every user after a sync,
  and a direct message from the maintainer to every Android user.
- **FR-023**: Each F-Droid repository MUST be signed, and served over HTTPS by the Pi at a
  stable address that an F-Droid client (F-Droid or Droid-ify) can add from a link or QR code.
  The link and the QR code MUST carry the repository key's fingerprint, so the client verifies
  the repository; the guide tells users never to add the address without it. The repository key
  has an offline backup; its loss or compromise is handled by making a new key and publishing a
  new link.
- **FR-024**: Each published APK MUST have a version code higher than every earlier APK of the
  same app identity, so the F-Droid client offers it as an update. The ordering is per app
  identity: the staging and production versions do not constrain one another, and the same
  commit delivered twice yields the same version code and changes nothing. The version name is
  the app configuration's version (`X.Y.Z`) for production, and that version followed by
  `-staging.<number>` for staging.
- **FR-025**: The Android build MUST upload its source maps and native debug files to error
  tracking, so reports stay readable (constitution VIII), as EAS Build did.
- **FR-026**: A migration guide MUST explain to an Android user how to move from the Google Play
  install to the F-Droid repository without losing data. It is written in French, published in
  the repository's documentation, and sent to every Android user by the maintainer. It tells the
  user not to uninstall while the synchronization cannot complete (server unreachable, errors):
  they must fix that first, because unsynchronized changes are lost with the install. The first
  production F-Droid release comes before the guide, and the guide before Google Play stops
  receiving builds, so no Android user is left without an update path.

**iOS distribution**

- **FR-027**: iOS builds MUST keep going through EAS Build; production builds MUST be submitted to
  TestFlight through EAS Submit, started from the delivery workflow rather than from the
  maintainer's machine. Production users are TestFlight internal testers; a submitted build
  reaches them without a beta review.
- **FR-028**: The only Expo credential GitHub holds MUST be one that can start builds and
  submissions, and cannot change billing or members; App Store credentials stay in EAS. Its
  scope is the Expo account, which holds only this project.

**Traceability**

- **FR-029**: Each server instance MUST expose its version and the commit it runs, without
  authentication and without revealing anything else.
- **FR-030**: Each delivery run MUST record its commit, its environment, and the outcome of each
  target (server, Android, iOS). For iOS, the outcome the run records is that the build was
  queued on EAS (with its link); the result of the build itself is followed in EAS.
- **FR-031**: The README's release and Pi deployment procedures MUST be replaced by the new
  workflow, including the one-time set-up of the staging instance, the F-Droid repositories, the
  signing key and the device registration.
- **FR-034**: The move of the existing production instance to the new layout MUST be a documented
  one-time procedure that leaves the old unit and the old database untouched until the new
  instance has passed its health check, states the expected downtime, and gives the steps to go
  back to the old unit if the migration fails.

### Key Entities

- **Environment**: staging or production. Has a server instance, a public server address, an
  Android app identity with its F-Droid repository, an iOS distribution channel, and an error
  tracking environment name.
- **Server release artifact**: the built server for one commit, ready to install on the Pi.
  Identified by its commit (and, for production, its version); carries proof of the workflow that
  produced it.
- **Deployment**: the installation of one server release artifact on one instance. Has a state
  (pending, installing, health-checking, succeeded, rolled back), a database copy, a start and
  end time, and an outcome reported to the maintainer.
- **App build**: one Android APK or iOS build for one commit and one environment, with its
  version and build number.
- **Release**: the maintainer's decision to deliver one commit as one version to production;
  groups one deployment and one app build per platform.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a non-documentation change is merged, the staging server runs it within
  15 minutes of CI turning green, with no manual step.
- **SC-002**: After a change to the app is merged, the Android staging build is published in the
  staging F-Droid repository within 30 minutes of CI turning green, with no manual step. The
  client then offers it when it next checks; that schedule is the client's (Assumptions).
- **SC-003**: A production release needs exactly one action from the maintainer, and no
  interactive session on the Pi or on their own machine.
- **SC-004**: A server version that fails to start is replaced by the previous version, with the
  previous data, within 5 minutes of the Pi starting that version, in every case tested.
- **SC-005**: Production server unavailability during a successful deployment, from the moment
  the old version stops answering to the first successful health answer of the new one, is under
  30 seconds, measured by a request every second.
- **SC-006**: The Pi accepts no new inbound connection type, and no secret in GitHub can open a
  session on the Pi (checked by inspecting the secrets list and the Pi's firewall and listening
  ports).
- **SC-007**: An Android user migrates from Google Play to the F-Droid repository in under
  10 minutes, from opening the guide to seeing their lists after signing in, losing no
  synchronized data. Settings kept only on the device are not synchronized data and are lost
  with the uninstall.
- **SC-008**: Over the first month, every delivery to staging or production can be traced back to
  its commit, and no delivery reached production without passing staging first.

## Assumptions

- "Touches the app" in the request means any change that is not documentation-only per
  `.github/scripts/app-changed.sh`; the server is delivered to staging on the same trigger
  (scope app + server), each only when its own code changed (FR-006).
- Staging is gated on the CI fast suite only; the thirty-minute Android device suite, which runs
  on every push to the default branch, is required before production (FR-010), not before
  staging.
- The staging server has its own subdomain under the same domain, served by the same reverse
  proxy on the Pi; the Pi's existing HTTPS port is not a new inbound port.
- The staging server sends real emails through the same mail relay, so invitations can be tried
  end to end; staging accounts are the maintainer's test accounts.
- The F-Droid repositories are served by the Pi alongside the servers; there is one repository
  per environment, so users add only the production one. Both are public URLs, unlisted: anyone
  who knows the staging address can read the staging APK. This is accepted, because the APKs
  hold no data and the app is unusable without an invited account.
- The F-Droid clients check for updates on their own schedule (Droid-ify in the background,
  F-Droid periodically), so the time between publication and the offer on the phone is theirs
  and is not a requirement of this feature.
- Only the maintainer's devices receive staging builds; on iOS, staging devices are registered
  once for ad hoc distribution.
- The iOS staging build uses its own bundle identifier, so it installs next to the production app
  (FR-003); this needs a one-time provisioning step in the Apple developer account.
- The app version (semantic versioning) is still set by hand in the pull request that leads to a
  release (README "Releases"); build numbers are set by the delivery workflow.
- Rollback applies to the server only. A faulty app release is fixed forward, as today, since an
  older app version does not open data saved by a newer one (001 FR-040).
- The manual device checks before a release (README "Device checks") are unchanged by this
  feature and stay a precondition of the release decision, not an automated gate.
- The repository stays private on a plan without branch protection; delivery workflows run on
  GitHub-hosted runners.
- Google Play stops receiving builds once the migration guide is published; closing the Google
  Play listing is a manual step outside this feature.
