# Agent Guidelines

Rules for the AI agents that work on this repository. The constitution (`.specify/memory/constitution.md`) is the authority; this file names the rules agents most often skip.

## Device suite before a push

Before you push a branch that changes the application, run the Android device suite on the commit you are about to push, and check that every journey passes:

```sh
pnpm test:e2e:android
```

- Whether a change touches the application is decided by `.github/scripts/app-changed.sh`, as `docs/procedures/merging-a-pull-request.md` explains. A documentation-only branch needs no device run.
- Run one device suite at a time. Never run the iOS and Android suites in parallel: that is what exhausted the memory of the development Mac and made Android journeys fail.
- Android on its own is allowed on this Mac (24 GB of memory). Do not skip the run for memory or load reasons without trying it. If the emulator or the suite cannot run, report the exact error and do not push.
- The commands, the device variables and the iOS rules are in [`docs/procedures/e2e-tests.md`](docs/procedures/e2e-tests.md).
