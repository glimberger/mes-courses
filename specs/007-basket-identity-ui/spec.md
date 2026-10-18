# Feature Specification: Basket-Identity UI Refresh

**Feature Branch**: `feat/007-basket-identity-ui`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "refonte UI plus proche du logo (identité panier) — Material 3, palette jaune vibrant, Nunito, cartes arrondies, tokens de formes, mode clair et sombre"

## Context

Mes Courses already has a strong brand identity on its startup screen: a shopping basket
illustration on a warm cream background with vibrant yellow and dark text. The rest of the
application interface does not yet reflect that identity; its action buttons look like a dull
olive color, its lists are flat, and it uses the device's default typeface.

This feature brings the whole application interface in line with the brand identity from the
startup screen, so a person opening any screen immediately recognizes the same basket, cream
and yellow. It is a presentation-only change: every shopping flow, piece of data and
offline behavior stays exactly as it is.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize the brand everywhere (Priority: P1)

As a person using Mes Courses, I want every screen to look like the same brand as the startup
screen, so that the application feels intentional, coherent and trustworthy.

**Why this priority**: Brand recognition is the core value of the redesign and applies to
every user, on every screen.

**Independent Test**: Open the application and move through the primary screens; confirm that
primary action controls, the floating action button and selected indicators use the brand's
vibrant yellow with dark text, that titles use the brand typeface, and that surfaces stay on
the warm cream family.

**Acceptance Scenarios**:

1. **Given** any primary screen, **When** a person looks at it, **Then** primary action
   controls (sign in, create, save, finish) are presented in the brand's vibrant yellow with
   dark readable text, matching the logo.
2. **Given** a screen with a floating action button, **When** it is displayed, **Then** the
   floating action button uses the same brand yellow and dark text treatment.
3. **Given** any screen heading or title, **When** it is displayed, **Then** it uses the
   brand's rounded typeface rather than the device's default one.
4. **Given** light appearance, **When** any screen is displayed, **Then** surfaces use the
   warm cream family and the brand yellow stays vivid; no olive or muddy yellow replaces it.

---

### User Story 2 - Scan a shopping list as rounded cards (Priority: P1)

As a person managing the current shopping list, I want each article shown as a distinct
rounded card with a clear checked state, so that I can quickly scan and tick items while
walking in a store.

**Why this priority**: The shopping list is the most used screen; readability there has the
highest impact on daily use.

**Independent Test**: Open a list containing several articles across categories and verify
that each article is a rounded, elevated card with wrapping text, that checked articles keep
their muted treatment (no strikethrough), and that category headings and the remaining-count
indicator are clearly styled.

**Acceptance Scenarios**:

1. **Given** a list with articles, **When** it is displayed, **Then** each article appears as
   a rounded card with generous spacing between cards.
2. **Given** an article whose text is long, **When** it is displayed, **Then** its name wraps
   onto multiple lines and the row keeps a comfortable height instead of clipping.
3. **Given** a checked article, **When** it is displayed, **Then** its name keeps a
   muted treatment (no strikethrough) and the selection marker is filled with the brand yellow.
4. **Given** articles grouped by category, **When** they are displayed, **Then** category
   headings are bold and muted, introduced by a small brand-yellow accent.
5. **Given** the floating action button on this screen, **When** it is displayed, **Then** it
   offers adding an article in the brand yellow treatment.

---

### User Story 3 - Browse my lists with a brand badge for the active one (Priority: P2)

As a person with several shopping lists, I want each list presented as a rounded card and the
current list clearly badged, so that I instantly recognize which list I am shopping.

**Why this priority**: This screen is the entry point to shopping and benefits from the same
coherent visual language.

**Independent Test**: Open the lists screen with at least two lists, one of which is current,
and verify rounded cards and a brand-yellow "current list" badge on the active one.

**Acceptance Scenarios**:

1. **Given** the lists screen, **When** it contains lists, **Then** each list is presented as
   a rounded, elevated card.
2. **Given** the current list, **When** it is shown, **Then** it carries a brand-yellow badge
   labeled "Liste actuelle".
3. **Given** an empty lists state, **When** it is shown, **Then** it presents a friendly
   message and an action to create the first list.

---

### User Story 4 - Add articles with a green "already in list" indicator (Priority: P2)

As a person adding articles to a list, I want articles already present to be clearly and
positively marked in green, so that I do not accidentally add duplicates.

**Why this priority**: Distinguishing already-added articles prevents mistakes during quick
shopping preparation.

**Independent Test**: Open the add-articles screen where some candidates are already in the
list, and verify that those candidates show a green "Déjà dans la liste" indicator instead of
an add action.

**Acceptance Scenarios**:

1. **Given** the add-articles screen, **When** an article candidate is already in the list,
   **Then** it shows a green "Déjà dans la liste" indicator and no duplicate add action.
2. **Given** a candidate not yet in the list, **When** it is shown, **Then** it offers a clear
   add action.
3. **Given** the search field, **When** it is displayed, **Then** it appears as a rounded
   stadium control on a neutral surface, with the brand typeface.

---

### User Story 5 - Recognize the brand at sign-in (Priority: P2)

As a person signing in, I want the brand's basket identity to greet me and the sign-in action
to use brand colors, so that the first impression is consistent with the rest of the app.

**Why this priority**: Sign-in is often the first thing a person sees and sets expectations.

**Independent Test**: Open the sign-in screen and verify the basket brand illustration and
application name at the top and a brand-yellow sign-in button with dark text.

**Acceptance Scenarios**:

1. **Given** the sign-in screen, **When** it is displayed, **Then** a basket brand illustration
   and the application name are shown at the top.
2. **Given** the sign-in button, **When** it is displayed, **Then** it uses the brand yellow
   with dark text.
3. **Given** other account actions (forgot password, create account), **When** they are
   presented, **Then** they remain readable secondary actions without competing with the
   brand button.

---

### User Story 6 - Browse settings in grouped brand cards (Priority: P3)

As a person adjusting settings, I want account, devices and sync status grouped into rounded
cards with tonal brand icons, so that the screen stays tidy and on-brand.

**Why this priority**: Settings is less frequent but should still belong to the same design
language.

**Independent Test**: Open the settings screen and verify grouped rounded cards, a sync status
row, and leading brand-toned icons.

**Acceptance Scenarios**:

1. **Given** the settings screen, **When** it is displayed, **Then** related settings are
   grouped into rounded cards rather than a flat list.
2. **Given** a sync status row, **When** it is displayed, **Then** it is shown in a
   clearly distinct, rounded strip with a sync indicator.
3. **Given** a setting row, **When** it is displayed, **Then** its leading icon appears in a
   soft brand-toned circular container.

---

### User Story 7 - Use rounded, brand-styled dialogs (Priority: P3)

As a person performing an action that opens a dialog (quantity, finish, delete, new list),
I want the dialog to match the brand styling and clearly distinguish destructive actions,
so that confirmations feel native and safe.

**Why this priority**: Dialogs are frequent touch points and must remain accessible and
unambiguous.

**Independent Test**: Open each main dialog and verify rounded 28 dp corners, brand typeface
titles, and the correct color treatment for brand versus destructive actions.

**Acceptance Scenarios**:

1. **Given** any standard dialog, **When** it is shown, **Then** it has rounded corners,
   a brand typeface title and a clear layout.
2. **Given** the quantity dialog, **When** it is shown, **Then** its fields are rounded and
   its tertiary action is visually secondary.
3. **Given** the finish-shopping dialog, **When** it is shown, **Then** its confirmation
   uses a brand-toned circular icon.
4. **Given** a destructive dialog (delete article), **When** it is shown, **Then** its icon
   and confirm button use the error color, not brand yellow.
5. **Given** the new-list dialog, **When** it is shown, **Then** its create action uses the
   brand yellow with dark text.

---

### User Story 8 - Meet friendly empty and error states (Priority: P3)

As a person encountering an empty or error situation, I want a clear title, message and
recovery action framed with a soft brand icon, so that the situation is understandable.

**Why this priority**: These moments shape trust when things are not straightforward.

**Independent Test**: Trigger empty and error states and verify a brand-toned circular icon
with hierarchically styled title and message and an available recovery action.

**Acceptance Scenarios**:

1. **Given** an empty state, **When** it is shown, **Then** it displays a soft brand-toned
   circular icon, a title, a supporting message and a primary action when one applies.
2. **Given** an error state, **When** it is shown, **Then** it states what failed in plain
   words and offers a recovery action when one exists, using the brand presentation (error
   color reserved only for the failure semantics already used).
3. **Given** loading, empty, error and content states on a data screen, **When** switching
   between them, **Then** each is rendered by its dedicated shared component.

---

### User Story 9 - Keep the brand in dark appearance (Priority: P2)

As a person using dark appearance, I want the brand identity preserved (cream swapped for a
dark surface, brand yellow unchanged) with readable contrast, so that night use feels native.

**Why this priority**: A significant part of usage happens in dark environments.

**Independent Test**: Switch the device to dark appearance and verify all core screens keep
the brand yellow, rounded surfaces and brand typeface with legible text.

**Acceptance Scenarios**:

1. **Given** dark appearance, **When** any core screen is displayed, **Then** surfaces use
   the dark family while the brand yellow remains vivid and consistent.
2. **Given** dark appearance, **When** text is displayed on brand surfaces, **Then** it
   remains legible with sufficient contrast in both treatments.

---

### User Story 10 - Remain accessible at any text size (Priority: P1)

As a person with accessibility needs, I want all refreshed components to keep their accessible
labels, minimum touch targets and readability at large text sizes, so that the visual refresh
does not reduce usability.

**Why this priority**: Accessibility must never regress; it is a blocking constraint rather
than a cosmetic option.

**Independent Test**: Enable 200% text size, a screen reader, and verify no clipping, all
interactive elements at least 48 dp, and unchanged accessible labels and test identifiers.

**Acceptance Scenarios**:

1. **Given** device text size set to 200%, **When** any screen is displayed, **Then** every
   label, article name, chip and button text wraps or scales without clipping its container.
2. **Given** any interactive element, **When** it is displayed, **Then** its touch target is
   at least 48 dp in both dimensions.
3. **Given** a screen reader, **When** navigating any refreshed screen, **Then** all existing
   accessible labels and roles behave as before the refresh.
4. **Given** an automated contrast check, **When** it runs in both appearances, **Then**
   every text combination passes standard contrast thresholds.

---

### User Story 11 - Launch with the brand identity (Priority: P3)

As a person installing or opening the application, I want the icon and startup screen to
reflect the basket brand on cream, so that the home screen and launch are consistent with
the rest of the app.

**Why this priority**: This completes the identity coverage but depends on artwork and
native configuration.

**Independent Test**: Install a staging or release build and verify the home-screen icon and
startup screen show the basket on a cream background in both appearance and staging variants.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the home screen is shown, **Then** the application
   icon shows the basket brand artwork on a cream background.
2. **Given** the staging build, **When** it is installed next to a release build, **Then**
   the two remain visually distinguishable while both keep the basket identity.
3. **Given** the startup splash, **When** the app launches, **Then** it shows the basket brand
   on cream and still transitions automatically without waiting for the network.

### Edge Cases

- A very long article or list name wraps instead of truncating illegibly; container heights
  grow accordingly.
- In dark appearance, the brand yellow is unchanged and contrast is preserved through text
  color, not by dimming yellow.
- Text scaling to 200% may stack chips and buttons vertically; scrolling remains available
  where content exceeds the screen.
- An offline device still renders the full branded interface and startup screen.
- If a brand illustration cannot be displayed at runtime, the screen still shows the
  application name on a themed background and continues (for the startup screen).
- Interactive controls keep at least 48 dp even when visually compact.
- Settings rows with a sync failure still offer a recovery action as before.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every primary action control across the application MUST use the brand's
  vibrant yellow with dark text.
- **FR-002**: Every title and heading across the application MUST use the brand's rounded
  typeface.
- **FR-003**: Shopping lists, articles, list entries and settings sections MUST be
  presented as rounded, elevated cards when a multi-item layout applies.
- **FR-004**: Checked articles MUST retain their muted treatment, with no strikethrough (removed in #134), with a
  brand-yellow selection marker.
- **FR-005**: Category headings on a shopping list MUST be bold and muted, introduced by a
  small brand-yellow accent.
- **FR-006**: Articles already in a list on the add-articles screen MUST be marked with a
  green "Déjà dans la liste" indicator and no duplicate add action.
- **FR-007**: On the lists screen, the current list MUST carry a brand-yellow "Liste
  actuelle" badge.
- **FR-008**: The sign-in screen MUST display the basket brand illustration and application
  name at the top and a brand-yellow sign-in button.
- **FR-009**: Settings MUST group related entries into rounded cards, with a distinct sync
  status strip and tonal brand leading icons.
- **FR-010**: Dialogs MUST have rounded corners, a brand typeface title, brand-yellow
  confirmation for non-destructive brand actions, and error styling for destructive
  confirmation.
- **FR-011**: The article search control MUST appear as a rounded stadium control on a
  neutral surface.
- **FR-012**: Empty and error states MUST display a soft brand-toned circular icon, a
  hierarchically styled title and message, and a recovery action when one exists.
- **FR-013**: The application MUST support both light and dark appearances, preserving the
  brand yellow and updating surfaces to the dark family, with readable contrast in both.
- **FR-014**: The application MUST remain fully usable with no network; the redesigned
  interface introduces no network dependency.
- **FR-015**: All interactive elements MUST keep a touch target of at least 48 dp and all
  accessible labels and identifiers MUST remain unchanged by the refresh.
- **FR-016**: All text MUST wrap or scale without clipping at a 200% text size.
- **FR-017**: All text and graphic color combinations MUST meet standard contrast
  thresholds in both appearances.
- **FR-018**: The application icon and startup splash MUST reflect the basket brand on a
  cream background, while preserving automatic splash transition and offline launch.
- **FR-019**: The staging build MUST remain visually distinguishable from the release build.
- **FR-020**: The visual refresh MUST NOT change any user flow, data, synchronization
  behavior, or accessible labels; it is presentational only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across the six primary screens, every primary action control renders in the
  brand yellow in both appearances (verified during review).
- **SC-002**: No text is clipped or truncated illegibly at a device text size of 200% on any
  primary screen (verified during review).
- **SC-003**: Every text and icon color combination meets standard contrast thresholds in
  both light and dark appearances (automated verification).
- **SC-004**: All interactive controls on the refreshed screens keep a touch target of at
  least 48 dp (automated verification).
- **SC-005**: Every existing automated functional test continues to pass after the refresh,
  with no renamed accessible labels or identifiers.
- **SC-006**: The fast test suite, linter, formatter and type checks all pass for the change.
- **SC-007**: Dark-appearance screenshots of all primary screens are consistent with the
  light ones and approved in review.
- **SC-008**: Startup time and offline launch behavior remain unchanged (launch completes
  within the same limits and without network).
- **SC-009**: Pull-request review includes screenshots of every refreshed shared component
  and screen, in both appearances, produced by the project's usual component review tooling.

## Assumptions

- The brand artwork for the basket illustration can be reused to derive a standalone
  basket-on-cream icon asset.
- The brand typeface is available as a bundled font so the application stays offline-capable;
  no network font loading is required.
- The refresh is purely presentational; no domain, application or synchronization code
  changes are required except where strictly needed to apply shared styling tokens.
- Existing user-facing text, accessibility labels and identifiers remain unchanged.
- Storybook stories and screenshots remain the review artifact and are regenerated after
  the refresh.
- Dark mode is mandatory and is delivered in the same change, not deferred.
- The six primary screens covered by SC-001 are: Current List, Lists, Add Articles,
  Sign-in, Settings and Accounts.
- The existing startup splash from the prior feature keeps its automatic, network-free
  transition; only its visual treatment changes.

## Scope and out-of-scope

### In scope

- Visual restyling of all existing screens and shared components to the basket identity.
- Brand typeface, shape, color and elevation token updates.
- Light and dark appearance updates.
- Application icon and startup screen artwork to match the brand identity.

### Out of scope

- Any change to application behavior, data model, synchronization, navigation or feature
  set.
- New features, screens or copy beyond the visual identity.
- A full rebrand beyond the existing basket-on-cream, yellow-and-dark palette.
