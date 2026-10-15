---

description: "Task list for the startup splash screen feature"
---

# Tasks: Startup Splash Screen

**Input**: Design documents from `/specs/006-splash-screen/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/ui-startup.md`, and `quickstart.md`

**Tests**: Tests are required by the feature specification and the project constitution. Each implementation task writes its failing behavior test first, then implements the minimum code needed to make it pass.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the supplied design asset available to the mobile build systems without changing the original design source.

- [X] T001 [P] Copy `design/splash-screen.png` unchanged to `apps/mobile/assets/splash-screen.png` and verify the two files have identical contents
- [X] T002 [P] Inspect `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, and existing UI test/story conventions to confirm the splash implementation uses the current Expo, React Native Paper, Jest, and Storybook setup without adding dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the existing startup and UI integration points that both stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Document the existing `Startup` state transitions and `composeApp()` readiness gate in `apps/mobile/App.tsx` without introducing a second state machine, timer, navigation route, or network gate
- [X] T004 [P] Confirm `apps/mobile/src/adapters/ui/screens/FullScreen.tsx` and `apps/mobile/src/adapters/ui/theme/theme-provider.tsx` expose the safe-area and Material 3 theme conventions required by the splash
- [X] T005 [P] Confirm the existing startup error, retry, too-old-data, and ready-screen behavior remains covered by `apps/mobile/App.test.tsx` before replacing only the `starting` presentation

**Checkpoint**: Existing startup lifecycle and shared UI conventions are understood; story implementation can proceed.

---

## Phase 3: User Story 1 - See the application identity at startup (Priority: P1) 🎯 MVP

**Goal**: Show the branded Mes Courses identity during pending local startup, transition automatically when local composition is ready, and preserve offline, retry, and update-required behavior.

**Independent Test**: In `apps/mobile/App.test.tsx`, keep local composition pending and verify the branded startup presentation is shown; resolve it and verify the existing first screen appears automatically; verify offline startup does not wait for synchronization and failures remain retryable.

### Implementation for User Story 1

- [X] T006 [US1] Write failing startup transition, offline readiness, failure/retry, and newer-data-version tests in `apps/mobile/App.test.tsx`, then replace the `starting` branch with `StartupSplash` while preserving the existing `ready`, `failed`, and `tooOld` branches and `composeApp()`-only readiness gate
- [X] T007 [P] [US1] Write failing component behavior and accessibility tests in `apps/mobile/src/adapters/ui/screens/StartupSplash.test.tsx`, then implement `apps/mobile/src/adapters/ui/screens/StartupSplash.tsx` with French `Mes Courses` identity semantics, no user actions, and a themed full-screen presentation
- [X] T008 [US1] Configure the native launch appearance in `apps/mobile/app.config.ts` to use `apps/mobile/assets/splash-screen.png` for the supported production and staging variants, with no change to synchronization or startup lifecycle behavior
- [X] T009 [US1] Add the `StartupSplash` component import and integration in `apps/mobile/App.tsx`, ensuring the existing `ThemeProvider`, status bar, safe-area handling, error reporting, retry action, and first navigation destination remain intact
- [ ] T010 [US1] Measure the cold-launch timing in the device validation for `apps/mobile/`: confirm the branded splash is visible within 1 second and the first usable screen is reached within 2 seconds in at least 95% of normal launches, recording the sample size and results for SC-001 and SC-002

**Checkpoint**: User Story 1 is independently functional: a cold launch shows the branded identity, local readiness transitions automatically, and offline/error/update-required paths are not blocked or swallowed.

---

## Phase 4: User Story 2 - Keep the startup experience legible (Priority: P2)

**Goal**: Keep the complete branded asset visible, proportional, themed, inset-safe, and accessible across supported display sizes and light/dark modes, with a visible French fallback if the image cannot render.

**Independent Test**: Render `StartupSplash` in light and dark themes with narrow, wide, and inset layouts; verify the image uses contain behavior without clipping or stretching, the French accessible name is exposed, and the fallback displays `Mes Courses` when the asset fails.

### Implementation for User Story 2

- [X] T011 [P] [US2] Write failing light-theme, dark-theme, safe-area, aspect-ratio, proportional-containment, and French accessibility tests in `apps/mobile/src/adapters/ui/screens/StartupSplash.test.tsx`, then implement the layout with existing Material 3 tokens and `FullScreen` conventions rather than hard-coded palette values
- [X] T012 [US2] Test the image component's `onError` event in `apps/mobile/src/adapters/ui/screens/StartupSplash.test.tsx`, then implement the visible French `Mes Courses` fallback in `apps/mobile/src/adapters/ui/screens/StartupSplash.tsx` without changing the parent startup lifecycle
- [X] T013 [P] [US2] Add light and dark visual-review stories for the complete, contained splash presentation in `apps/mobile/src/adapters/ui/screens/StartupSplash.stories.tsx`, using the existing Storybook decorator and theme setup
- [X] T014 [US2] Update `specs/006-splash-screen/quickstart.md` to use the implemented source paths and validation commands, keeping the cold-launch, offline, safe-area, theme, accessibility, fallback, and timing checks executable

**Checkpoint**: User Story 2 is independently functional: the visual identity remains complete and legible under supported themes, dimensions, insets, and asset failure.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature and preserve repository quality gates.

- [X] T015 [P] Run the focused mobile tests for `apps/mobile/App.test.tsx` and `apps/mobile/src/adapters/ui/screens/StartupSplash.test.tsx`, fixing only implementation or test issues in the feature paths
- [X] T016 [P] Run `yarn workspace @mes-courses/mobile typecheck` and `yarn workspace @mes-courses/mobile lint` against `apps/mobile/App.tsx`, `apps/mobile/app.config.ts`, and `apps/mobile/src/adapters/ui/screens/StartupSplash.tsx`
- [ ] T017 Run `yarn format:check` and the repository fast suite (`yarn test` and `yarn test:architecture`) after all feature changes, recording any required fixes in the affected feature files
- [ ] T018 Run the Storybook visual review from `apps/mobile/` on narrow and large displays in light and dark themes, then run the required cold-launch/offline device validation for the native configuration change and record results in the pull request test plan

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 have no feature dependencies and can start immediately.
- **Foundational (Phase 2)**: T003–T005 depend on the existing repository being available and block both user stories.
- **User Story 1 (Phase 3)**: T006–T010 depend on Phase 2; T009 follows T006 and T007 because it integrates their behavior; T010 follows T009 and requires a device build.
- **User Story 2 (Phase 4)**: T011–T014 depend on T007 and can proceed independently of the startup orchestration work after the shared component exists.
- **Polish (Phase 5)**: T015–T018 depend on the desired story work being complete; T018 additionally depends on the native configuration in T008.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2; no dependency on User Story 2. This is the MVP.
- **User Story 2 (P2)**: Can start after Phase 2 and the shared `StartupSplash` component task T007; it does not change the startup state machine.

### Within Each User Story

- Tests are written first inside the implementation task and must be observed failing before production code is added.
- Component/layout behavior is established before application-root integration.
- The existing startup state contract is preserved while the `starting` presentation changes.

## Parallel Opportunities

- T001 and T002 can run in parallel.
- T003, T004, and T005 can run in parallel.
- T006 and T007 can run in parallel because they primarily modify different test/source areas; T009 follows both.
- T011 and T013 can run in parallel once T007 is complete.
- T015 and T016 can run in parallel after implementation; T017 follows their fixes.
- After Phase 2, separate developers can work on US1 and US2, with US2 consuming only the shared component contract from T007.

## Parallel Example: User Story 1

```text
Developer A: T006 — startup lifecycle and offline/error tests plus App.tsx integration
Developer B: T007 — StartupSplash component and component-level accessibility tests
After both complete: T008 native configuration, then T009 integration verification and T010 timing validation
```

## Parallel Example: User Story 2

```text
Developer A: T011 and T012 — responsive/theme/accessibility/fallback behavior
Developer B: T013 — light/dark Storybook visual-review story
After both complete: T014 quickstart path and validation update
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete T006 and T007 with tests written and observed failing first.
3. Complete T008 and T009.
4. Run the independent User Story 1 test criteria and verify offline startup, retry, and update-required behavior.
5. Stop for review or proceed to User Story 2.

### Incremental Delivery

1. Deliver the P1 branded startup lifecycle as the MVP.
2. Add P2 responsive, themed, accessible, and fallback behavior without changing the startup gate.
3. Run the polish and device validation phase before merging the native configuration change.

## Notes

- `[P]` marks tasks that can run in parallel without editing the same incomplete implementation.
- `[US1]` and `[US2]` map tasks to the priorities in `specs/006-splash-screen/spec.md`.
- No persisted entity, synchronization contract, server change, dependency, or navigation route is required.
- All checklist entries include a task ID; story tasks include a story label; implementation entries identify exact repository paths.
