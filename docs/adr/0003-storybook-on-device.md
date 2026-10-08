# ADR-0003: Screen validation with on-device Storybook

- **Status**: Accepted
- **Date**: 2026-10-06
- **Decided by**: maintainer
- **Supersedes**: none
- **Related**: [research R22](../../specs/001-shopping-lists/research.md#r22-screen-validation-with-storybook),
  constitution Principles II, III, V and IX

## Context

Every screen has several states (loading, empty, error, success) that Principle IX requires, and
a new shared component needs a visual review (Principle V). Walking the app into an error or a
loading state by hand is slow, and a broken screen state is only noticed at the next review.

## Decision

We use Storybook for React Native (`@storybook/react-native`) on the device, inside
`apps/mobile/`, as the catalog of the UI adapter:

- every component of the shared module, and every screen and dialog in each of its states, has a
  story next to it (`*.stories.tsx`);
- screen stories get their data through the real store and use cases on in-memory fakes, so no
  story can show a state the store cannot reach;
- Storybook is bundled only when `STORYBOOK_ENABLED=true`; release, EAS and Detox builds contain
  no story;
- one Jest test renders every story in both color schemes and fails on a throw, a React warning,
  or a story the required list is missing; a person validates the look on a device before merging.

## Consequences

- One place shows every screen state with realistic French data, rendered with the same native
  components and fonts as the app.
- A new screen state cannot ship without its story, and a broken story fails the next test run.
- The look of a screen is reviewed by hand, in light and dark mode. Nothing catches a visual
  regression automatically.
- dependency-cruiser gains rules: Storybook and testing helpers stay out of production code.

## Alternatives considered

- **Storybook for the web (`react-native-web-vite`)**: renders React Native Web, not the native
  components, and is a second Storybook to configure.
- **Automated visual regression** (Chromatic, or screenshot diffing in Vitest or Detox): an
  external service or a second test runner, and native screenshots are not stable across emulator
  images, against Principle III. It can be added if manual review misses regressions.
- **A dev-only gallery screen in the app**: rebuilds Storybook's navigation by hand.
