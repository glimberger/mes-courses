# Feature Specification: Mockup-Faithful UI

**Feature Branch**: `feat/008-mockup-fidelity-ui`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "la refonte UI ne me satisfait pas, elle ne suit pas les maquettes établies en html. Voici les maquettes à suivre (captures des écrans 1 à 10). La police est Nunito et ses variations. Les maquettes en html sont ici : design/mockups/"

## Context

Feature 007 (basket-identity UI refresh) moved the application toward the brand, but the
result does not match the approved HTML mockups in `design/mockups/`. The maintainer rejects
it as delivered. This feature closes that gap: every screen and dialog that has a mockup
must look like its mockup, and the screens without one must follow the same visual
language.

The mockups are the reference. Where this spec and a mockup disagree, the mockup wins, except
for user-facing text and behavior, which stay as they are in the application today (the
mockups use sample data such as "Léa" or "courses.example.fr").

| # | Mockup | Screen or dialog |
|---|--------|------------------|
| 1 | `1-liste.html` | Current list ("Ma liste") |
| 2 | `2-listes.html` | Lists ("Mes listes") |
| 3 | `3-ajouter.html` | Add articles ("Ajouter des articles") |
| 4 | `4-connexion.html` | Sign-in ("Connexion") |
| 5 | `5-reglages.html` | Settings ("Réglages") |
| 6 | `6-liste-dark.html` | Current list, dark appearance |
| 7 | `7-dialog-quantite.html` | Quantity dialog |
| 8 | `8-dialog-terminer.html` | Finish-shopping dialog |
| 9 | `9-dialog-supprimer.html` | Delete-article dialog |
| 10 | `10-dialog-nouvelle-liste.html` | New-list dialog |
| 11 | `11-splash.html` | Startup screen |
| 12 | `12-snackbar.html` | Snackbar (undo offer and notices) |
| 13 | `13-snackbar-dark.html` | Snackbar, dark appearance |

Mockups 12 and 13 were added with this spec: the snackbar had no mockup.

The design tokens the mockups use (colors for both appearances, corner radii, shadows, text
sizes and weights) are defined in `design/mockups/styles.css`. PNG captures of every mockup
at phone size are in `design/mockups/shots/`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the brand typeface with its full range of weights (Priority: P1)

As a person using Mes Courses, I want all text to use Nunito with the weights the mockups
use, so that the application has the same rounded, solid look as the mockups instead of a
thin, generic one.

**Why this priority**: Typography is the most visible gap; it affects every screen, and the
maintainer named it explicitly.

**Independent Test**: Open each primary screen next to its mockup capture and compare text
weights: titles, article names, category headings, chips, buttons and secondary lines.

**Acceptance Scenarios**:

1. **Given** any screen, **When** it is displayed, **Then** every piece of text, including
   field values, placeholders, chips and button labels, uses Nunito.
2. **Given** screen titles, category headings, button labels and the floating action button,
   **When** they are displayed, **Then** they use the extra-bold weight, as in the mockups.
3. **Given** article names, list names, setting row titles, chips, quantities and the
   snackbar message, **When** they are displayed, **Then** they use the bold weight;
   secondary lines (article count, last sync time, dialog messages) use the semi-bold weight.
4. **Given** any screen, **When** it is displayed, **Then** no text uses a regular or thin
   weight where the mockup shows a heavier one.

---

### User Story 2 - Shop from a list that looks like mockup 1 (Priority: P1)

As a person shopping, I want the current list screen to match mockup 1, so that the screen I
use most is the one the design approved.

**Why this priority**: The current list is the most used screen.

**Independent Test**: Open a list with articles in several categories, some checked and some
with a quantity, and compare it side by side with `shots/1-liste.png`.

**Acceptance Scenarios**:

1. **Given** the current list, **When** it is displayed, **Then** its name is a large
   left-aligned extra-bold title, with a rounded tonal chip below it giving the number of
   remaining articles ("3 articles restants").
2. **Given** the header, **When** it is displayed, **Then** the finish-shopping, lists and
   settings actions appear as three icons on the right of the title, in that order.
3. **Given** articles grouped by category, **When** they are displayed, **Then** each
   category heading is a short brand-yellow vertical bar followed by the category name in
   extra-bold, muted text.
4. **Given** an article, **When** it is displayed, **Then** it is a white rounded card with a
   soft shadow holding, from left to right: a rounded-square checkbox, the name in bold, the
   quantity in smaller muted bold text right after the name, then an edit (pencil) icon and a
   remove (cross) icon.
5. **Given** a checked article, **When** it is displayed, **Then** its checkbox is filled with
   brand yellow with a dark outline and a dark check mark, and its name is struck through in
   muted text.
6. **Given** a long article name, **When** it is displayed, **Then** it wraps on several lines
   inside its card, with the quantity and icons staying aligned.
7. **Given** the screen, **When** it is displayed, **Then** an extended brand-yellow floating
   action button with a plus icon and the label "Ajouter" sits in the bottom-right corner, with
   rounded (not fully round) corners and dark text.

---

### User Story 3 - Pick a list from cards that look like mockup 2 (Priority: P2)

As a person with several lists, I want the lists screen to match mockup 2, so that I can spot
the current list at a glance.

**Why this priority**: Entry point to shopping; second most visited screen.

**Independent Test**: Open the lists screen with three lists, one of them current, and compare
it with `shots/2-listes.png`.

**Acceptance Scenarios**:

1. **Given** the lists screen, **When** it is displayed, **Then** its title "Mes listes" is
   centered.
2. **Given** a list, **When** it is displayed, **Then** it is a white rounded card holding a
   soft-yellow circle with a list icon, the list name in bold, its article count below in
   smaller text ("4 articles", "0 articles", as today), and a chevron on the right.
3. **Given** the current list, **When** it is displayed, **Then** its card has a brand-yellow
   border and a brand-yellow chip "Liste actuelle" with a check mark in place of the chevron.
4. **Given** the screen, **When** it is displayed, **Then** an extended brand-yellow floating
   action button "Nouvelle liste" with a plus icon sits in the bottom-right corner.

---

### User Story 4 - Add articles from a screen that looks like mockup 3 (Priority: P2)

As a person preparing a list, I want the add-articles screen to match mockup 3, so that I see
at once what is already in my list and what I can add.

**Why this priority**: Frequent screen whose current layout departs most from the mockup.

**Independent Test**: Open the add-articles screen with categories holding articles already in
the list, articles not in the list, and an empty category, and compare it with
`shots/3-ajouter.png`.

**Acceptance Scenarios**:

1. **Given** the screen, **When** it is displayed, **Then** its title "Ajouter des articles" is
   left-aligned with a plus action on the right that creates a new article.
2. **Given** the search field, **When** it is displayed, **Then** it is a full-width stadium on
   a tonal surface, with a magnifier icon and the placeholder "Rechercher un article".
3. **Given** an article already in the list, **When** it is displayed, **Then** its card shows
   the name in bold, a green chip "Déjà dans la liste" with a check mark, and a vertical
   three-dot menu.
4. **Given** an article not in the list, **When** it is displayed, **Then** its card shows the
   name in bold, a round soft-yellow add button with a plus icon, and a vertical three-dot
   menu.
5. **Given** a category with no article, **When** it is displayed, **Then** its card shows the
   muted text "Aucun article dans cette catégorie" and a text action "Créer un article".
6. **Given** categories, **When** they are displayed, **Then** their headings use the same
   yellow-bar style as the current list.

---

### User Story 5 - Sign in on a screen that looks like mockup 4 (Priority: P2)

As a person signing in, I want the sign-in screen to match mockup 4, so that the first screen I
see carries the brand.

**Why this priority**: First impression of the application.

**Independent Test**: Open the sign-in screen and compare it with `shots/4-connexion.png`.

**Acceptance Scenarios**:

1. **Given** the sign-in screen, **When** it is displayed, **Then** the logo (basket and the
   name "Mes Courses") appears at the top inside a rounded tile with a soft shadow.
2. **Given** the form fields (server address, email, password, device name), **When** they are
   displayed, **Then** each is an outlined field with large rounded corners and its label
   sitting in the top border.
3. **Given** the password field, **When** it is displayed, **Then** it has an eye icon to show
   or hide the password.
4. **Given** the sign-in action, **When** it is displayed, **Then** it is a full-width
   brand-yellow stadium button "Se connecter" with dark extra-bold text, followed by a centered
   text link "Mot de passe oublié ?".

---

### User Story 6 - Manage settings in cards that look like mockup 5 (Priority: P3)

As a person adjusting settings, I want the settings screen to match mockup 5, so that it
belongs to the same design as the rest of the application.

**Why this priority**: Visited less often.

**Independent Test**: Open the settings screen and compare it with `shots/5-reglages.png`.

**Acceptance Scenarios**:

1. **Given** the settings screen, **When** it is displayed, **Then** its title "Réglages" is
   centered and a full-width tonal strip below it shows the sync status with a cloud icon
   ("En attente de synchronisation").
2. **Given** the screen, **When** it is displayed, **Then** it is divided into the sections
   "Compte", "Serveur", "Appareils" and "Actions", each introduced by a yellow-bar heading and
   holding one white rounded card.
3. **Given** a card row (account, server, device), **When** it is displayed, **Then** it starts
   with a soft-yellow circle holding an icon, followed by a bold title and an optional muted
   second line; the device row ends with a chevron.
4. **Given** the account card, **When** it is displayed, **Then** it holds an outlined stadium
   button "Changer de mot de passe".
5. **Given** the server card, **When** it is displayed, **Then** it holds the last sync time
   and a brand-yellow stadium button "Synchroniser maintenant" with a sync icon.
6. **Given** the actions card, **When** it is displayed, **Then** it holds an outlined button
   "Se déconnecter de cet appareil" with a logout icon, and an outlined button "Supprimer mon
   compte" with a trash icon whose border, icon and text use the error color.

---

### User Story 7 - Confirm actions in dialogs that look like mockups 7 to 10 (Priority: P2)

As a person editing a quantity, finishing shopping, deleting an article or creating a list, I
want each dialog to match its mockup, so that confirmations feel consistent and destructive
actions stand out.

**Why this priority**: Dialogs appear in every shopping session.

**Independent Test**: Open each of the four dialogs and compare them with
`shots/7-dialog-quantite.png` to `shots/10-dialog-nouvelle-liste.png`.

**Acceptance Scenarios**:

1. **Given** any dialog, **When** it is shown, **Then** it is a white card with very rounded
   corners over a dimmed background, with an extra-bold title and its actions aligned to the
   right: a text "Annuler" and a stadium confirmation button.
2. **Given** the quantity dialog, **When** it is shown, **Then** the article name is the title,
   the "Quantité" and "Unité" fields sit side by side as rounded outlined fields, the text
   action "Effacer la quantité" sits below them on the left, and the confirmation is a
   brand-yellow "Enregistrer".
3. **Given** the finish-shopping dialog, **When** it is shown, **Then** a soft-yellow circle with
   a cart icon sits above a centered title "Terminer les courses ?" and a centered message, and
   the confirmation is a brand-yellow "Terminer".
4. **Given** the delete-article dialog, **When** it is shown, **Then** a soft-red circle with a
   trash icon sits above a centered title and message, and the confirmation "Supprimer" is a
   filled error-red button with white text.
5. **Given** the new-list dialog, **When** it is shown, **Then** its title "Nouvelle liste" is
   left-aligned, it holds one rounded outlined field "Nom", and the confirmation is a
   brand-yellow "Créer".

---

### User Story 8 - Keep the mockup look in dark appearance (Priority: P2)

As a person using dark appearance, I want the screens to match mockup 6, so that night use
keeps the same design with the brand yellow unchanged.

**Why this priority**: Dark appearance is supported and already has a mockup.

**Independent Test**: Switch the device to dark appearance, open the current list and compare
it with `shots/6-liste-dark.png`; then open the other screens and dialogs and check they use
the same dark tokens.

**Acceptance Scenarios**:

1. **Given** dark appearance, **When** the current list is displayed, **Then** the background is
   near-black warm, cards are a slightly lighter dark surface, text is warm off-white, and the
   checkbox, category bars and floating action button keep the same brand yellow as in light
   appearance.
2. **Given** dark appearance, **When** any other screen or dialog is displayed, **Then** it uses
   the dark tokens of `design/mockups/styles.css` with the same layout as its light mockup.

---

### User Story 9 - Undo an action from a snackbar that looks like mockups 12 and 13 (Priority: P2)

As a person who just removed an article from the list or deleted an article, I want the
"Annuler" offer, and the other short notices, to match mockups 12 and 13, so that this
frequent message belongs to the same design as the rest of the application.

**Why this priority**: The undo offer appears after every removal while shopping.

**Independent Test**: Remove an article from the current list, in light then in dark
appearance, and compare the snackbar with `shots/12-snackbar.png` and
`shots/13-snackbar-dark.png`; then trigger a notice (for example "« Lait » ajouté") and check
it uses the same style.

**Acceptance Scenarios**:

1. **Given** light appearance, **When** the undo offer appears, **Then** it is a dark warm
   card with 16 dp corners and a soft shadow, across the screen width with side margins, its
   message in bold warm off-white text and the action "Annuler" in extra-bold gold text on the
   right.
2. **Given** dark appearance, **When** the undo offer appears, **Then** the card is light
   warm, its message dark and the action "Annuler" dark gold, as in mockup 13.
3. **Given** a screen with a floating action button, **When** the snackbar appears, **Then** it
   sits above the button and never covers it.
4. **Given** a notice without an action, **When** it appears, **Then** it uses the same card,
   text and position, without the action.
5. **Given** a long message, **When** it is displayed, **Then** it wraps on several lines and
   the action stays aligned on the right.
6. **Given** a notice shown during an undo offer, **When** both are visible, **Then** they are
   stacked as today, the notice above the offer, both in the mockup style.

---

### User Story 10 - Find the same look on screens without a mockup (Priority: P3)

As a person using a screen that has no mockup (accounts, create account, password reset,
change password, devices, category picker, empty, error and loading states), I want it to use
the same building blocks as the mockups, so that no screen looks out of place.

**Why this priority**: Completes consistency but has no reference image to match.

**Independent Test**: Open each screen without a mockup and check that it uses only the
building blocks shown in the mockups (title styles, yellow-bar headings, white rounded cards,
soft-yellow icon circles, stadium buttons, rounded outlined fields, chips).

**Acceptance Scenarios**:

1. **Given** a screen without a mockup, **When** it is displayed, **Then** its titles, headings,
   cards, buttons, fields and chips are identical in style to the same elements in the
   mockups.
2. **Given** an empty or error state, **When** it is displayed, **Then** it shows a soft-yellow
   (or soft-red for errors) icon circle like the dialogs, an extra-bold title, a semi-bold
   message and a stadium action when one applies.

### Edge Cases

- A long article, list or device name wraps inside its card; icons, chips and chevrons stay
  vertically aligned and never overlap the text.
- At a 200% device text size, chips and buttons may grow and wrap; nothing is clipped and the
  content scrolls when it exceeds the screen.
- The floating action button never hides the last card: the list leaves enough space below it.
- A list with a single article reads "1 article"; any other count, zero included, reads
  "N articles", as today (FR-012: no text change).
- The remaining-articles chip is hidden or reads accordingly when no article remains, as
  today.
- With no network, every screen renders identically: the typeface and icons are bundled and
  nothing is loaded at runtime.
- A sync failure in settings still shows its recovery action, styled with the mockup
  building blocks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every screen and dialog listed in the Context table MUST match its mockup in
  layout, element order, colors, corner radii, spacing, icons, text sizes and text weights,
  in light appearance and, for the current list and the snackbar, in dark appearance. Every
  other screen and dialog MUST use the dark tokens of `design/mockups/styles.css` in dark
  appearance, with its light mockup's layout.
- **FR-002**: All text MUST use Nunito; the semi-bold, bold and extra-bold weights MUST be
  available and used as in the mockups (extra-bold for titles, headings, buttons and the
  floating action button; bold for item names, chips, quantities and the snackbar message;
  semi-bold for secondary text).
- **FR-003**: Every color the mockups use MUST come from a Material 3 color role of the
  application theme, `design/material-theme.json`, which stays the single source of colors.
  The theme MUST be updated so that these roles carry the mockup values of
  `design/mockups/styles.css` in both appearances, including the brand yellow `#FFDE3F` with
  dark text `#3A3000`, the green chip, the cream background and the white cards.
- **FR-003a**: The soft yellow of icon circles and of the round add button (`#FFF1BE` in light,
  `#3A3200` in dark), which no role of the current theme holds, MUST be added to the theme as
  a color role with its pair for the content drawn on it, in both appearances.
- **FR-003b**: Each element MUST use the same color role in both appearances. Where the
  mockups' light and dark values for one element (for example cards: `#FFFFFF` in light,
  `#1E1B13` in dark) belong to two different roles in the current theme, the theme MUST be
  updated so that one role carries both values.
- **FR-003c**: Updating the theme MUST keep its contrast variants (medium and high, light and
  dark) consistent with the changed roles.
- **FR-004**: Cards MUST be white (light) or dark surface (dark), with 16 dp corners and the
  soft two-layer shadow of the mockups; dialogs MUST have 28 dp corners.
- **FR-005**: Category and section headings MUST be a short brand-yellow vertical bar followed
  by extra-bold muted text.
- **FR-006**: The checkbox MUST be a rounded square: muted outline when unchecked; brand-yellow
  fill with a dark outline and a dark check mark when checked.
- **FR-007**: Floating action buttons MUST be extended (icon and label), brand yellow with dark
  extra-bold text, with 18 dp rounded corners as in the mockups, rather than a full pill or
  circle.
- **FR-008**: Buttons MUST be stadium-shaped; the three variants are brand (yellow fill, dark
  text), outlined (muted border, brand-dark text) and destructive (error border and text, or
  error fill with white text in the delete dialog).
- **FR-009**: Form fields MUST be outlined with large rounded corners (16 dp on screens, 14 dp
  in dialogs) and the label sitting in the top border.
- **FR-010**: Icons MUST be the rounded icon style used by the mockups, at the weights shown.
- **FR-010a**: The undo offer and every notice MUST use the snackbar of mockups 12 and 13: the
  inverse surface color role, 16 dp corners, a soft shadow, the message in bold, and the
  action in extra-bold using the inverse primary color role; its timing, stacking and
  announcements stay as they are today.
- **FR-011**: Screens without a mockup MUST be built only from the building blocks that appear
  in the mockups (FR-002 to FR-010).
- **FR-012**: The change MUST NOT alter any user flow, user-facing text, data,
  synchronization behavior, accessible label or test identifier.
- **FR-013**: Every interactive element MUST keep a touch target of at least 48 dp and all text
  MUST stay readable without clipping at a 200% text size.
- **FR-014**: Every text and graphic color pair MUST meet standard contrast thresholds in both
  appearances.
- **FR-015**: The interface MUST render identically with no network connection; no typeface,
  icon or image is fetched at runtime.

### Key Entities

- **Mockup**: one approved HTML page in `design/mockups/` and its PNG capture; the visual
  reference for one screen or dialog.
- **Design token**: a named color, radius, shadow, text size or weight shared by every
  screen. Its reference value is in `design/mockups/styles.css`; colors live in the theme
  `design/material-theme.json` as Material 3 roles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of the 13 mockups, a capture of the application in the same state,
  placed side by side with the mockup capture, shows no difference the maintainer flags in
  layout, colors, typography, icons or shapes (verified in pull-request review).
- **SC-002**: The maintainer approves the visual result in review; the redesign is no longer
  rejected as "not following the mockups".
- **SC-003**: 100% of the text on the 13 reference screens uses Nunito, and none uses the
  regular weight where the mockup shows semi-bold or heavier.
- **SC-004**: Every mockup color of both appearances is held by a role of
  `design/material-theme.json` whose value equals the one in `design/mockups/styles.css`, and
  the application uses no color outside the theme (automated verification).
- **SC-005**: Every text and icon color pair passes standard contrast thresholds in both
  appearances (automated verification).
- **SC-006**: Every existing automated functional test and end-to-end journey passes without
  renaming any accessible label or identifier.
- **SC-007**: No text is clipped at a 200% text size on any of the reference screens.

## Assumptions

- The mockups are final and approved; this feature does not redesign them. When the mockups
  and the default Material 3 component styles differ, the mockups win.
- The application stays a Material 3 application: the mockups are a customization of
  Material 3 through its tokens (color roles, shapes, typography). Known departures from the
  default component styles are deliberate and come from the mockups: fully rounded chips
  (default 8 dp), a 24 dp checkbox with 7 dp corners and a dark outline when checked (default
  18 dp, 2 dp), soft shadows on cards (default tonal elevation), Nunito semi-bold to
  extra-bold (default 400 and 500), an 18 dp corner on the extended floating action button
  (default 16 dp) and 16 dp corners on fields (default 4 dp).
- Keeping `design/material-theme.json` as the single source of colors and updating it with
  the mockup values satisfies the constitution's single design system principle; no
  amendment is needed.
- The sample data in the mockups (names, addresses, counts) is illustrative only; the
  application keeps its real data and its current French texts. Where a mockup label differs
  from the application's current wording, the current wording stays unless it is a pure
  presentation label introduced by the mockups (for example the "Liste actuelle" chip).
- One mockup color fails the contrast threshold: the empty-category text of mockup 3 uses
  `--muted` (`outline`, 4.48:1 on the white card in light). It uses `onSurfaceVariant`, the
  color of the other secondary lines, instead; FR-014 wins over FR-001 for this pair.
- Status-bar content and the red autofill icon visible in the sign-in mockup capture come from
  the mockup frame and the browser, not from the design, and are out of scope.
- The startup screen (mockup 11) was delivered by feature 006; it is only checked against its
  mockup here and fixed if it differs.
- Dark appearance for screens other than the current list derives from the dark tokens of
  `design/mockups/styles.css` with the light mockup's layout.
- The existing shared component module is the place where the building blocks live; the
  correction mainly changes shared components and theme tokens, and screens only where
  their composition differs from the mockup.
- Nunito is bundled with the application in every weight the mockups use (semi-bold, bold,
  extra-bold, plus regular where still needed), so the app stays offline-capable.
- Captures used for SC-001 come from the project's usual component review and screenshot
  tooling.

## Scope and out-of-scope

### In scope

- Bringing every screen, dialog and shared component in line with the HTML mockups.
- Theme tokens (colors, typography weights, shapes, shadows) aligned with
  `design/mockups/styles.css`, including the update of `design/material-theme.json` with the
  mockup colors (new soft-yellow role, card role identical in both appearances).
- Light and dark appearances.

### Out of scope

- New features, screens, flows or text.
- Changes to the mockups themselves.
- The application icon and the startup screen artwork, unless they differ from mockup 11.
