# Implementation Plan: Basket-Identity UI Refresh

**Branch**: `feat/007-basket-identity-ui` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-basket-identity-ui/spec.md`

## Summary

Bring every screen of Mes Courses to the brand identity already used by the startup splash:
warm cream surfaces, a vibrant yellow action color with dark text, the Nunito typeface,
rounded elevated cards, rounded field/dialog shapes and the basket-on-cream illustration. The
change is presentational only: no domain, application, navigation, sync or store code changes;
the parts that move are the Material 3 theme tokens, the shared UI components, the shared
text/empty/error/loading states and the native icon/splash artwork. Color comes from
`design/material-theme.json`, shapes from a new shape-token module, typography from bundled
Nunito font files and the existing `spacing` tokens.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict); React 19.3; React Native 0.88.0-rc.3; Expo SDK 58

**Primary Dependencies**: React Native Paper 5.15 (Material 3), Expo (`expo-font`), `react-native-safe-area-context`, Jest 30 + React Native Testing Library, Storybook for on-device visual review

**Storage**: None for this feature. The existing SQLite/secure-store/sync data flow is unchanged; no migration, entity or protocol change is introduced.

**Testing**: Jest fast suite (app + node projects), React Native Testing Library component tests, Storybook stories rendered in light and dark, `yarn typecheck`, `yarn lint`, `yarn format:check`, the required-story test, and the WCAG contrast test in `theme.test.ts`. Device end-to-end and iOS runs are unchanged by this presentational change.

**Target Platform**: Android and iOS builds produced by the existing Expo configuration, in both light and dark appearance, portrait orientation, with the existing safe-area support.

**Project Type**: Offline-first mobile app (single `apps/mobile` workspace); server and `packages/sync-core` are untouched.

**Performance Goals**: No startup or render-time regression; the app still reaches its first usable screen within the existing limits and renders with no network. Font loading and theming are the only added startup work, and they gate nothing.

**Constraints**: Presentational only (FR-020); Material 3 only, themed from `design/material-theme.json` as the single color source (Principle V); all user-facing text remains French in the UI adapter (Principle X); all prior accessible labels and identifiers remain unchanged (FR-015); minimum 48 dp touch targets (FR-015); no text clipping at 200% text size (FR-016); both appearances meet contrast thresholds (FR-017); offline first (Principle VII); strict test-first development (Principle I).

**Scale/Scope**: All 6 primary screens plus dialogs, all shared UI components, theme/token modules and 2 native asset sets (production + staging). No new backend, package or persisted entity.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

* **PASS** — Principle I: every visual change lands with the component/screen test update that drives it; no speculative component is added ahead of a failing test.
* **PASS** — Principle II: the spec's acceptance scenarios map to observable UI behavior, accessibility labels and the required Storybook stories; traceability is kept.
* **PASS** — Principle III: the fast suite stays deterministic and offline; theme and contrast checks run locally in seconds, and no test reaches the network.
* **PASS** — Principle IV: the font need is solved by bundling TTF assets with the already-present `expo-font` instead of adding a dependency; no speculative abstraction beyond the shared UI module.
* **PASS** — Principle V: a single Material 3 design system and `design/material-theme.json` as the single color source. Shapes gain a token module mirroring the Material shape scale; no second styling system and no hard-coded color or spacing values in screens.
* **PASS** — Principle VI: the change stays in the UI adapter. No domain or application package, use case or port is touched.
* **PASS** — Principle VII: no network, server reachability or sync change; offline rendering remains intact and is covered by the existing offline tests.
* **PASS** — Principle VIII: no new failure path is introduced; image-load failures keep the existing fallback and report through the existing channel.
* **PASS** — Principle IX: loading, empty and error states remain modeled by their dedicated shared components, which are restyled rather than replaced by ad hoc views.
* **PASS** — Principle X: all user-facing text, including any new secondary labels, stays French and in the UI adapter.
* **PASS** — Principle XI: the change is confined to `apps/mobile` and its repository-level design assets; the monorepo layout and shared package are untouched.
* **PASS** — Quality Gates: the fast suite, linter, formatter and type checks remain the merge gate; the change is not documentation-only, so native runs stay scheduled per the usual device-suite rule.

## Architecture Decisions

Relies on [ADR 0001](../../docs/adr/0001-react-native-expo.md) for the Expo mobile stack, [ADR 0003](../../docs/adr/0003-storybook-on-device.md) for the on-device UI review workflow and [ADR 0004](../../docs/adr/0004-detox-end-to-end-tests.md) for the end-to-end validation workflow. No new long-lived architecture decision is introduced: the brand colors, shapes and typography are design tokens, not repository-layout or stack decisions, so they live in this feature's `research.md` rather than an ADR.

## Project Structure

### Documentation (this feature)

```text
specs/007-basket-identity-ui/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-identity.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
design/
├── material-theme.json                   # updated brand yellow roles (research R1)
├── assets/                               # existing basket/splash source art reused
└── mockups/                              # reference HTML gallery (already committed)

apps/mobile/
├── app.config.ts                         # unchanged; splash/icon paths unchanged
├── assets/
│   ├── fonts/                           # new bundled Nunito TTFs (research R2)
│   ├── icon.png, staging/icon.png        # replaced with basket-on-cream artwork
│   ├── android-icon-foreground.png, ...   # replaced with basket artwork
│   └── splash-screen.png                 # unchanged; already basket on cream
└── src/adapters/ui/
    ├── theme/
    │   ├── theme.ts                     # colors + Nunito typography + roundness
    │   ├── theme-provider.tsx            # unchanged (system scheme + Paper)
    │   ├── used-color-pairs.ts           # checkbox + dialog pairs added
    │   ├── spacing.ts                    # unchanged (4 dp grid)
    │   └── shape.ts                     # new shape token module (research R3)
    ├── components/
    │   ├── ArticleRow.tsx               # green "Déjà dans la liste" indicator
    │   ├── Button.tsx                   # unchanged wrapper; call sites use tonal mode
    │   ├── EmptyState.tsx               # soft brand icon + hierarchy
    │   ├── ErrorState.tsx               # soft brand icon + recovery action
    │   ├── ListItemRow.tsx              # rounded card, brand-yellow checked marker
    │   ├── LoadingState.tsx             # themed spinner, label unchanged
    │   ├── NameField.tsx                # rounded field already Paper; typography
    │   ├── QuantityFields.tsx            # rounded fields, secondary tertiary action
    │   ├── ScreenFab.tsx                # unchanged logic; primaryContainer is now brand
    │   ├── StateLayout.tsx              # spacing only
    │   ├── StateMessage.tsx             # typography hierarchy
    │   └── ...                          # other shared components receive token updates
    └── screens/
        ├── CurrentListScreen.tsx        # card rows + category headers with yellow accent
        ├── ListsScreen.tsx              # card rows + "Liste actuelle" badge
        ├── AddArticlesScreen.tsx         # stadium search + green indicator
        ├── SignInScreen.tsx             # basket brand illustration + tonal button
        ├── SettingsScreen.tsx           # grouped cards + sync strip + tonal icons
        ├── AccountsScreen.tsx           # same visual language
        ├── CreateArticleScreen.tsx
        ├── EditArticleScreen.tsx
        ├── ChoosePasswordScreen.tsx
        └── ...Dialog.tsx               # 28 dp corners and brand/error coloring
```

**Structure Decision**: The work stays entirely inside the existing mobile UI adapter and the repository-level design assets. No new workspace, package, route, port or use case is introduced; the theme/token modules and the shared UI component module (Principle V) absorb the refresh, and the screens remain layout-only with visual choices coming from components and tokens.

## Complexity Tracking

No constitution violations; no complexity exception is required. The only new token module (`shape.ts`) is the shared home for radii, matching the existing `spacing.ts`, rather than an ad hoc style.

## Post-Design Constitution Check

* **PASS** — The design keeps the application domain and ports untouched and routes every visual decision through shared components and tokens, with `shape.ts` joining `spacing.ts`.
* **PASS** — `material-theme.json` remains the single color source; only its primaryContainer/onPrimaryContainer roles move to the brand yellow, with contrast documented in `used-color-pairs.ts`.
* **PASS** — No new network, storage, sync or accessibility contract changes; the fast suite and offline behavior remain unchanged.
* **PASS** — All French labels, focus moves and at least 48 dp targets are preserved; screen readers see no difference beyond the restyled presentation.
* **PASS** — The refresh remains scoped to visual tokens, shared components and native artwork, with `data-model.md` and `contracts/ui-identity.md` documenting the observable rules.
