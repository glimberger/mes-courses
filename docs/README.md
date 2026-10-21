# Documentation

The [project README](../README.md) is the entry point: what the app does, how to install, run and
test it. This folder holds the rest, split by nature: explanations, which describe how things are,
and procedures, which are runbooks to follow step by step.

## Explanations

| Document                                          | What it covers                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| [Architecture](architecture.md)                   | The hexagonal layers of the app and the server                       |
| [Repository layout](repository-layout.md)         | The monorepo folders and what each holds                             |
| [Sync server](sync-server.md)                     | Running the server in development, signing in, environment variables |
| [Icons](icons.md)                                 | The Material Symbols font subset and how to regenerate it            |
| [Agent guardrails](agent-guardrails.md)           | What the Claude Code rules and hooks allow in this repository        |
| [Build-time flags](build-time-flags.md)           | The test-only flags, refused by production builds                    |
| [Story screenshots](story-screenshots.md)         | Capturing every Storybook story in light and dark                    |
| [Store privacy details](store-privacy-details.md) | What to declare if the app is published on a store                   |
| [Privacy and security](privacy-and-security.md)   | Error reporting region, account security, alerts                     |
| [The delivery agent](delivery-agent.md)           | How the Pi's agent deploys a release, step by step                   |
| [Architecture decision records](adr/README.md)    | The lasting technical decisions                                      |

## Procedures

| Procedure                                                                          | When to use it                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [On the Pi and one-time set-up](procedures/pi-setup.md)                            | Setting up the Pi for staging and production             |
| [Delivery to staging](procedures/delivery-to-staging.md)                           | Understanding and checking a staging delivery            |
| [Rollback and failed deployments](procedures/rollback.md)                          | A deployment failed, or a commit must be delivered again |
| [Updating the agent](procedures/updating-the-agent.md)                             | Installing a new delivery agent release on the Pi        |
| [Upgrading a Pi that ran 004](procedures/upgrading-a-pi-that-ran-004.md)           | Migrating a Pi that deployed with `git pull`             |
| [EAS builds and error tracking](procedures/eas-builds.md)                          | Building with EAS, its variables and credentials         |
| [Sentry alerts](procedures/sentry-alerts.md)                                       | Setting the alert rules in Sentry                        |
| [End-to-end tests](procedures/e2e-tests.md)                                        | Running the Detox journeys on a device                   |
| [Device checks](procedures/device-checks.md)                                       | The manual checks and measurements before a release      |
| [Releases](procedures/releases.md)                                                 | Cutting a release with `yarn release`                    |
| [Losing or exposing a signing key](procedures/losing-or-exposing-a-signing-key.md) | A signing key is lost or compromised                     |
| [Android: from Google Play to F-Droid](procedures/google-play-to-fdroid.md)        | Moving Android users to the F-Droid repository           |
| [Merging a pull request](procedures/merging-a-pull-request.md)                     | The checks to pass before merging                        |
