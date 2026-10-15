# Implementation Plan: Startup Splash Screen

**Branch**: `feat/006-splash-screen` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-splash-screen/spec.md`

## Summary

Add a branded, non-interactive startup presentation using `design/splash-screen.png`, shown while
the existing local application composition starts. The implementation will replace the current
generic startup loading view with a shared UI-adapter splash component, keep the existing startup
error and retry behavior, and configure the native launch appearance to use the same branded asset
where the platform supports it. Network synchronization remains outside the startup gate.

## Technical Context

**Language/Version**: TypeScript 6.0; React 19.3; React Native 0.88.0-rc.3; Expo SDK 58

**Primary Dependencies**: Expo, React Native Paper 5.15, react-native-safe-area-context, Jest 30,
React Native Testing Library

**Storage**: N/A for the splash; existing SQLite startup remains unchanged

**Testing**: Jest unit/UI tests, Storybook story and existing Detox/device validation where needed

**Target Platform**: Android and iOS mobile builds supported by the existing Expo app, portrait
orientation with safe-area support

**Project Type**: Offline-first mobile app

**Performance Goals**: Branded view visible within 1 second and first usable screen reached within
2 seconds in 95% of normal launches; no additional network wait

**Constraints**: Material 3 tokens from `design/material-theme.json`; both light and dark themes;
French UI; no one-off visual system; safe-area and accessibility support; strict test-first
development; original supplied assets remain unchanged

**Scale/Scope**: One startup state in `apps/mobile`, one derived design asset, no new persisted
data, no server or synchronization changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

* **PASS** — Principle I: add failing UI/startup tests before production changes.
* **PASS** — Principle II: acceptance scenarios map to observable tests for the splash, transition,
  offline startup, accessibility and fallback behavior.
* **PASS** — Principle V: use the existing Material 3 theme and shared `FullScreen` layout; the
  splash is a project UI component, not a second design system.
* **PASS** — Principle VII: the splash gates only local composition; synchronization is started
  after the local store is ready and never blocks the transition.
* **PASS** — Principle IX: startup states remain explicit: branded starting, application ready,
  startup error and too-old-data state.
* **PASS** — Principle X: all new user-facing text and accessibility labels are French and live in
  the UI adapter.
* **PASS** — Principle VIII: no new unexpected failure path is swallowed; existing startup error
  reporting and fallback behavior remain observable.

## Architecture Decisions

Relies on [ADR 0001](../../docs/adr/0001-react-native-expo.md) for the Expo mobile stack and
[ADR 0003](../../docs/adr/0003-storybook-on-device.md) for the on-device UI review workflow. No new
long-lived architecture decision is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-splash-screen/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-startup.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
design/
└── splash-screen.png                 # derived branded startup asset

apps/mobile/
├── App.tsx                            # startup state selects the branded splash
├── App.test.tsx                       # startup transition and failure behavior
├── app.config.ts                      # native launch appearance configuration
├── assets/
│   └── splash-screen.png               # bundled copy of the design asset
└── src/adapters/ui/
    └── screens/
        ├── StartupSplash.tsx           # themed, accessible presentation
        ├── StartupSplash.test.tsx      # component behavior and accessibility
        └── StartupSplash.stories.tsx   # light/dark visual review
```

**Structure Decision**: Keep startup orchestration in the existing mobile application root and put
the visual presentation in the UI adapter. Reuse the existing `FullScreen` and `ThemeProvider`
rather than introducing a new application layer or navigation route. Keep the asset at `design/`
so the Material 3 export and supplied visual inputs remain repository-level design sources.

## Complexity Tracking

No constitution violations; no complexity exception is required.

## Post-Design Constitution Check

* **PASS** — The design keeps tests ahead of implementation and maps each startup contract case to
  an automated test.
* **PASS** — The design adds no domain or application-layer dependency; the splash remains a UI
  adapter and native configuration concern.
* **PASS** — The design uses the existing Material 3 theme, safe-area conventions and shared full
  screen shell, with no second UI library or hard-coded theme palette.
* **PASS** — The design makes local startup the only gate and leaves synchronization off the critical
  path, including offline launches.
* **PASS** — The design keeps all French display text and accessibility labels in the UI adapter.
* **PASS** — No persisted entities, server contracts or synchronization rules are added.
