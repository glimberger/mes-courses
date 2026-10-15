# Research: Startup Splash Screen

## Decision 1: Use native and in-app splash layers

**Decision**: Configure Expo's native launch splash with the adapted branded asset, and render a
themed `StartupSplash` component from `App.tsx` while local startup is pending.

**Rationale**: The native layer covers the interval before JavaScript loads. The in-app layer keeps
the identity visible while `composeApp()` opens and prepares the local database, supports Material 3
themes and accessibility, and preserves the existing startup error/retry states. Either layer alone
would leave a startup gap: native-only cannot express the React startup states, while in-app-only
cannot cover the pre-JavaScript launch frame.

**Alternatives considered**:

- In-app component only: simpler and theme-aware, but cannot cover the earliest cold-launch frame.
- Native splash only: immediate, but cannot remain tied to the existing startup lifecycle or expose
  the accessibility and fallback semantics required by the feature.
- Holding the native splash until initialization completes: possible with explicit native splash
  lifecycle control, but it complicates the existing error/retry flow and leaves the accessible
  startup presentation outside the React UI.

## Decision 2: Reuse the existing startup lifecycle

**Decision**: Keep `composeApp()` as the only readiness gate. Replace the `starting` branch's generic
`LoadingState` with the branded component; do not add a timer, network check or navigation route.

**Rationale**: `composeApp()` performs local database and store preparation. Synchronization starts
only after the local store is ready, so this directly satisfies offline-first behavior without
introducing a second startup state machine.

**Alternatives considered**:

- A fixed-duration splash: rejected because it makes startup slower on fast devices and does not
  guarantee readiness on slow devices.
- Waiting for synchronization: rejected by the offline-first constitution principle and FR-004.

## Decision 3: Keep the asset in the mobile bundle

**Decision**: Keep `design/splash-screen.png` as the design source and add an identical app-local
copy under `apps/mobile/assets/` for Metro and native Expo configuration. Point both production and
staging native splash variants to that app-local asset.

**Rationale**: Expo native configuration and Metro asset resolution are reliable for files inside the
mobile workspace. The root design asset remains the source of truth for review, while the app-local
copy makes the asset available to both build systems without runtime file access.

**Alternatives considered**:

- Referencing `../../design/splash-screen.png` directly from the app configuration: rejected because
  native asset resolution outside the app workspace is platform/toolchain dependent.
- Using the existing icon-only splash: rejected because it omits the readable “Mes Courses” identity
  and does not satisfy FR-002.

## Decision 4: Use contain scaling and theme-controlled surroundings

**Decision**: The React component renders the asset with proportional contain scaling inside the
existing themed full-screen shell and safe-area insets. The asset is not stretched or cropped.

**Rationale**: The supplied composition is portrait and already includes generous margins. Contain
scaling preserves the complete basket and wordmark on narrow, wide and inset displays. The shell's
background comes from the active Material 3 theme, so the component remains coherent in light and
dark modes even though the supplied art itself is light.

**Alternatives considered**:

- Cover scaling: rejected because it can crop the identity on different aspect ratios.
- A second dark-specific artwork: rejected as unnecessary scope; the themed shell provides the dark
  presentation while the brand tile remains readable.

## Decision 5: Accessibility and fallback are explicit UI behavior

**Decision**: Give the image an accessible French label identifying Mes Courses, and render a French
text fallback if the image cannot be displayed. Test both behaviors at component level.

**Rationale**: Native launch configuration cannot provide the full accessibility semantics of the
React view, and image loading can fail independently of startup composition. The fallback must never
block the application from reaching its existing error or ready state.
