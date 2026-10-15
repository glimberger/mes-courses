# Quickstart: Validate the Startup Splash Screen

## Prerequisites

- Repository dependencies installed with `yarn install`.
- A supported Android emulator, iOS simulator, or physical device for cold-launch review.
- The device may be offline for the offline scenario.

## Fast validation

From the repository root:

```sh
yarn workspace @mes-courses/mobile test --runInBand App.test.tsx
yarn workspace @mes-courses/mobile test --runInBand src/adapters/ui/screens/StartupSplash.test.tsx
yarn workspace @mes-courses/mobile typecheck
yarn eslint apps/mobile/App.tsx apps/mobile/src/adapters/ui/screens/StartupSplash.tsx
yarn format:check
```

Expected results:

- A pending local composition renders the branded splash and not only the generic loading indicator.
- Resolving local composition transitions automatically to the existing first screen.
- Startup failure still shows the French retryable error; retry returns to the branded splash.
- The component exposes the French accessible identity, uses contain scaling, follows light/dark
  themes and exposes the fallback text behavior.
- The source files under `apps/mobile/src/adapters/ui/screens/` include the `StartupSplash` tests
  and light/dark Storybook review stories.

## Visual validation

Start the on-device Storybook or development app:

```sh
yarn workspace @mes-courses/mobile storybook
```

Review the startup story on a narrow phone, a larger display, light mode and dark mode. Confirm the
complete basket and `Mes Courses` wordmark remain visible, with no clipping or stretching and no
content behind system insets.

The story source is `apps/mobile/src/adapters/ui/screens/StartupSplash.stories.tsx`; use the
`Light` and `Dark` entries with the simulator's corresponding system color scheme.

## Cold-launch validation

Build and launch the existing Android or iOS development target, force-stop it, then open it again.
Confirm that the native launch frame and the React startup presentation use the same branded identity,
and that the first usable screen appears after local preparation without waiting for network access.

The observable cases and expected outcomes are defined in [contracts/ui-startup.md](contracts/ui-startup.md).
