# Feature Specification: Startup Splash Screen

**Feature Branch**: `feat/006-splash-screen`
**Created**: 2026-10-15
**Status**: Draft
**Input**: User description: "ajoute un écran splashscreen ; les images sont là dans le dossier design à la racine"

## Context

The application currently needs a branded startup experience. The `design/` directory contains two
provided visual assets: a shopping basket and checklist icon, and a branded “Mes Courses” image
that combines the basket illustration with the application name. This feature introduces a brief,
non-interactive splash screen while the application prepares its first usable screen.

The splash screen is presentation-only. It must not wait for network synchronization or prevent the
offline-first application from becoming usable.

## Clarifications

### Session 2026-10-15

- Q: Le splash screen doit-il rester visible pendant une durée minimale, même si l’application est prête immédiatement ? → A: Aucun délai minimal ; transition dès que l’application est prête.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the application identity at startup (Priority: P1)

As a person opening Mes Courses, I want to immediately recognize the application through its
shopping-themed visual identity so that the transition into the application feels intentional and
trustworthy.

**Why this priority**: A recognizable startup is the primary value of the feature and applies to
every application launch.

**Independent Test**: Launch the application from a closed state and verify that the branded splash
screen is shown before the first usable application screen, then verify that the application can be
used normally after the transition.

**Acceptance Scenarios**:

1. **Given** the application is closed, **When** a person opens it, **Then** a splash screen shows
   the provided Mes Courses visual identity with the application name clearly readable.
2. **Given** the splash screen is visible, **When** startup preparation is complete, **Then** the
   application transitions automatically to its normal first screen without requiring a tap.
3. **Given** the device has no network connection, **When** a person opens the application, **Then**
   the splash screen and transition still complete without waiting for synchronization.

---

### User Story 2 - Keep the startup experience legible (Priority: P2)

As a person using a small, large, light, or dark display, I want the splash screen to remain legible
and visually coherent so that the brand is recognizable regardless of device conditions.

**Why this priority**: A splash screen that is clipped, distorted, or unreadable undermines the
feature's only user-facing purpose.

**Independent Test**: Review the splash screen on supported display sizes and both appearance modes,
checking that the visual asset is contained, the name is readable, and no content is clipped.

**Acceptance Scenarios**:

1. **Given** a supported display in either appearance mode, **When** the splash screen is shown,
   **Then** its background and surrounding presentation use the application's Material 3 theme and
   the supplied image remains proportionally scaled and fully visible.
2. **Given** a display narrower or wider than the design asset, **When** the splash screen is shown,
   **Then** the asset is adapted to the available space without stretching or cropping its identity.

### Edge Cases

- If startup preparation takes longer than usual, the splash screen remains visible until the first
  screen is ready, but it does not wait for remote synchronization.
- If a provided visual asset cannot be displayed, the screen still presents the application name on
  a themed background and continues to the application rather than leaving the person blocked.
- If the device has a display cutout or system insets, no important part of the visual identity is
  hidden behind them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST show a splash screen when opened from a closed state before
  showing the first usable application screen.
- **FR-002**: The splash screen MUST use the adapted Mes Courses visual asset
  `design/splash-screen.png` derived from the supplied design and display the application name in
  a readable form.
- **FR-003**: The splash screen MUST transition automatically to the first usable application screen
  after local startup preparation is complete.
- **FR-004**: The splash screen MUST NOT require network availability or remote synchronization to
  complete its transition.
- **FR-005**: The splash screen MUST preserve the visual asset's proportions and keep its meaningful
  content visible across supported display sizes and orientations.
- **FR-006**: The splash screen MUST use the project's Material 3 design tokens and provide a
  coherent presentation in both light and dark appearance modes.
- **FR-007**: The splash screen MUST respect system display insets and keep the application name and
  visual identity accessible to assistive technologies.
- **FR-008**: If the visual asset reports a runtime loading failure through the image component's
  `onError` event, the application MUST show a themed fallback containing the application name and
  continue startup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 95% of launches on supported devices, the splash screen is visible within 1 second
  of opening the application.
- **SC-002**: In 95% of launches with normal local startup conditions, the person reaches the first
  usable application screen within 2 seconds of opening the application.
- **SC-003**: 100% of tested supported display sizes and both appearance modes show the complete
  visual identity without distortion, clipping, or unreadable application text.
- **SC-004**: 100% of offline launch tests reach the first usable application screen without a
  network request being required for the transition.
- **SC-005**: At least 90% of usability-test participants recognize the application as Mes Courses
  from the splash screen without additional explanation.

## Assumptions

- The splash screen is shown on cold launches; returning to the foreground without closing the
  application does not restart it.
- There is no minimum display duration; the splash transitions as soon as local startup is ready.
- The existing first application screen remains the destination; this feature does not change list,
  account, or synchronization behavior.
- The provided `design/Panier jaune et liste de courses.png` asset is the preferred source; the
  adapted `design/splash-screen.png` is the presentation asset for the splash screen.
- `design/Icône panier de courses et checklist.png` remains available as a fallback or
  complementary identity asset if the target display requires it.
- The splash screen has no user interaction and no persisted data.
- The existing Material 3 theme and shared UI components provide the visual tokens and accessibility
  conventions required by this feature.
