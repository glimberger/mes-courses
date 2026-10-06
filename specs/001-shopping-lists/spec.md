# Feature Specification: Shopping Lists

**Feature Branch**: `feat/001-shopping-lists`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Mes courses est une application mobile qui me permet de gérer mes listes de courses. Quand j'arrive dans l'application, je suis sur ma liste des cours en cours où Je peux mettre ou enlever un article de mon caddie (coche/décoche). Je peux modifier ma liste de courses En ajoutant ou en enlevant des articles que je peux créer.Les articles sont regroupés dans des catégories. Un certain nombre est créé par défaut, mais je peux en rajouter des nouvelles.  Je peux aussi créer une ou plusieurs listes d'articles en les nommant."

## Clarifications

### Session 2026-10-05

- Q: Are named lists separate shopping lists, one of which is "current" and opened at launch,
  or reusable templates added to the current list? → A: Separate, independent shopping lists.
  The user chooses which one is current; the current list opens at launch. Each list keeps its
  own items and its own ticked states.
- Q: When shopping is over, what happens to ticked items? → A: A "finish shopping" action
  unticks every item of the list and keeps all items, so the list is ready for the next trip.
- Q: Does an item on a list carry a quantity? → A: An article in the catalog has no quantity.
  When the article is added to a list, the user may give a quantity with a unit for that list
  item, and can change it later.
- Q: When an item is removed from a list, is there a confirmation, an undo, or neither?
  → A: The item is removed immediately and an "Annuler" snackbar is shown for a few seconds;
  undoing restores the item with its quantity and ticked state.
- Q: On the add screen, how are articles already on the current list shown? → A: They stay
  visible with an "already on the list" mark; tapping one says so and offers to change its
  quantity. The add screen never removes items.
- Q: Which accessibility level does this feature commit to? → A: Screen reader support with
  French labels announcing ticked state and quantity, system text size followed up to 200%
  without loss of content, touch targets of at least 48 dp, and ticked state never conveyed
  by color alone.

### Session 2026-10-06

- Q: When saving a tick fails, is the item shown ticked at once and then reverted, or only once
  the save is confirmed? → A: Shown at once; if the save fails, the item returns to its
  previous state, a French message is shown and the error is reported.
- Q: How long is "Annuler" offered after removing an item, and does it change with a screen
  reader? → A: 5 seconds; while a screen reader is on, the offer stays until the user
  dismisses it or makes another change.
- Q: When no item of the list is ticked, what happens to "Terminer les courses"? → A: It is
  hidden, and shown as soon as at least one item is ticked.
- Q: Does the add screen get its own loading and error scenarios, and does search have states
  of its own? → A: The add screen gets loading and error scenarios like the current list's;
  search filters the already loaded catalog and has no loading or error state of its own.
- Q: What happens to the "Annuler" offer on a second removal, or when the user leaves the
  screen, switches the current list or closes the app? → A: Only the last removal can be
  undone: any other change (including a new removal or switching the current list) ends the
  offer and makes the removal final, and so does closing the app; moving between screens
  does not end it.
- Q: What minimum color contrast applies, including dimmed ticked rows and the dark theme?
  → A: WCAG 2.2 AA everywhere, ticked rows included, in light and dark: 4.5:1 for text, 3:1
  for icons and the checkbox.
- Q: How are gestures counted in SC-003, given the "Ajouter" confirmation after choosing an
  article? → A: Every tap counts, "Ajouter" and tapping the search field included; scrolling
  does not: at most 3 taps when browsing, at most 3 taps and 3 letters when searching.
- Q: Where does screen reader focus go when a dialog opens or closes, after a removal, and when
  a ticked item moves? → A: An opening dialog takes focus and gives it back to the element that
  opened it; after a removal, focus goes to the next item (the previous one if none, the empty
  state if the list is empty); a ticked or unticked item keeps focus as it moves.
- Q: Which changes outside the focused element does the screen reader announce? → A: Every
  snackbar and every form error message as it appears; the remaining count is not announced
  and stays readable in the subtitle.
- Q: On which device and with which figure are SC-001, SC-002 and SC-008 measured? → A: On a
  release build, on an entry-level Android phone about five years old and on the maintainer's
  iPhone; SC-008 means at least 55 frames per second while scrolling and ticking, with each
  tick shown within 100 ms.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tick items off the current list while shopping (Priority: P1)

When I open the application, I land directly on my current shopping list. Its items are
grouped by category, each shown with its quantity when it has one. In the store, I tap an item
to put it in my cart (it is shown as ticked) and tap it again to take it out of my cart (it is
shown as unticked again). When I am done, I finish shopping: every item is unticked and stays
on the list, ready for next time. This works in the store even with no network.

**Why this priority**: ticking items off in the store is the moment the application exists
for. Without it, the list is a plain note.

**Independent Test**: start with a current list that already holds a few items, open the
application, tick and untick items, close and reopen the application, check the ticked state
was kept, then finish shopping and check every item is unticked and still present.

**Acceptance Scenarios**:

1. **Given** a current list holding "Lait" (Crèmerie, 2 L) and "Pommes" (Fruits et légumes,
   no quantity), **When** I open the application, **Then** the current list is the first
   screen shown, its name is displayed, and its items appear under their category headings,
   "Lait" showing "2 L".
2. **Given** "Lait" is unticked on the current list, **When** I tap it, **Then** it is shown
   as in the cart (ticked) immediately.
3. **Given** "Lait" is ticked, **When** I tap it, **Then** it is shown as not in the cart
   (unticked) immediately.
4. **Given** I ticked "Lait", **When** I close and reopen the application, **Then** "Lait" is
   still ticked.
5. **Given** the device has no network, **When** I open the application and tick items,
   **Then** everything works the same as with a network and no error is shown.
6. **Given** a mix of ticked and unticked items in one category, **When** I view the list,
   **Then** unticked items are shown before ticked items within that category, so what is
   left to buy stays at the top.
7. **Given** a current list of 5 items with 2 ticked, **When** I view it, **Then** it shows
   that 3 items are left to put in the cart.
8. **Given** some items of the current list are ticked, **When** I choose "Terminer les
   courses" and confirm, **Then** every item is unticked and every item, with its quantity,
   is still on the list.
9. **Given** some items are ticked, **When** I choose "Terminer les courses" and cancel the
   confirmation, **Then** nothing changes.
10. **Given** the current list holds no item, **When** I open the application, **Then** an
    empty state says the list is empty ("Votre liste est vide") and offers to add items.
11. **Given** the list is still being read from the device, **When** the screen appears,
    **Then** a loading state is shown, never a blank screen.
12. **Given** the list cannot be read from the device, **When** the screen appears, **Then**
    an error state says in French that the list could not be loaded, offers to retry, and the
    error is reported.

---

### User Story 2 - Add and remove items on a list, with an optional quantity (Priority: P1)

I edit my current list by adding articles to it and removing articles from it. I pick
articles from my catalog of known articles, grouped by category, or I search for one by name.
When an article does not exist yet, I create it on the spot by giving it a name and a
category. When I add an article to a list, I may give a quantity with a unit (for example
"6", "500 g" or "2 L"); I can change or clear that quantity later from the list.

**Why this priority**: the list has to be filled before it can be ticked off; Stories 1 and 2
together form the minimum usable application.

**Independent Test**: from an empty current list, add existing articles with and without a
quantity, create a new article, change a quantity, remove one item, and check the list content
matches.

**Acceptance Scenarios**:

1. **Given** the article "Beurre" exists in the catalog and is not on the current list,
   **When** I add it without a quantity, **Then** it appears on the current list under its
   category, unticked, with no quantity shown.
2. **Given** "Farine" exists in the catalog, **When** I add it with quantity "1,5" and unit
   "kg", **Then** it appears on the list showing "1,5 kg".
3. **Given** "Farine" is on the list with "1,5 kg", **When** I change its quantity to "2" and
   unit "kg", **Then** it shows "2 kg", and the article in the catalog is unchanged.
4. **Given** "Farine" is on the list with "2 kg", **When** I clear its quantity, **Then** it is
   shown with no quantity.
5. **Given** "Farine" is on the list "Courses de la semaine" with "2 kg", **When** I add
   "Farine" to the list "Gâteau" with "500 g", **Then** each list keeps its own quantity.
6. **Given** "Beurre" is on the current list, **When** I remove it, **Then** it no longer
   appears on the current list but stays in the catalog, and an "Annuler" action is offered
   for 5 seconds.
7. **Given** no article named "Houmous" exists, **When** I type "Houmous", choose the category
   "Épicerie salée" and confirm, **Then** the article is created in the catalog and added to
   the current list.
8. **Given** "Beurre" is already on the current list, **When** I browse or search the catalog
   to add articles, **Then** "Beurre" is shown with a mark saying it is already on the list,
   and tapping it does not duplicate it: I am told it is already on the list and offered to
   change its quantity.
9. **Given** an article named "Beurre" exists, **When** I try to create an article named
   " beurre " (different case or surrounding spaces), **Then** no duplicate is created and the
   existing "Beurre" is offered instead.
10. **Given** I type part of a name, "pom", **When** I search the catalog, **Then** articles
    whose name contains it, ignoring case and accents ("Pommes", "Pommes de terre"), are
    shown.
11. **Given** I try to create an article with an empty or blank name, **When** I confirm,
    **Then** the article is not created and a French message asks for a name.
12. **Given** I enter a quantity of "0", a negative number or text that is not a number,
    **When** I confirm, **Then** the quantity is refused and a French message explains that it
    must be a positive number.
13. **Given** I enter a unit with no quantity, **When** I confirm, **Then** the unit is
    refused and a French message asks for a quantity.
14. **Given** a search finds no article, **When** I look at the results, **Then** an empty
    state says no article matches and offers to create one with the typed name.
15. **Given** the catalog holds no article in a category, **When** I browse that category,
    **Then** an empty state says so and offers to create an article.
16. **Given** I removed "Farine" (ticked, "2 kg") from the current list, **When** I choose
    "Annuler" while it is offered, **Then** "Farine" is back on the list, ticked, with "2 kg".
17. **Given** the catalog is still being read from the device, **When** the add screen
    appears, **Then** a loading state is shown, never a blank screen.
18. **Given** the catalog cannot be read from the device, **When** the add screen appears,
    **Then** an error state says in French that the articles could not be loaded, offers to
    retry, and the error is reported.

---

### User Story 3 - Manage several named lists and choose the current one (Priority: P2)

I can create one or more shopping lists and give each a name (for example "Courses de la
semaine", "Barbecue"). I choose which list is current; the current list is the one shown when
I open the application. Each list has its own items, quantities and ticked states.

**Why this priority**: useful for different stores or occasions, but a single list (Stories 1
and 2) already covers everyday use.

**Independent Test**: create a list "Barbecue", make it current, add items and tick one, then
switch back to the first list and check its items and ticks are untouched; reopen the
application and check "Barbecue" is shown if it was current.

**Acceptance Scenarios**:

1. **Given** a fresh installation, **When** I open the application, **Then** one empty list
   named "Ma liste" exists and is current.
2. **Given** I have the list "Ma liste", **When** I create a list named "Barbecue", **Then**
   it appears among my lists with that name, empty.
3. **Given** the lists "Ma liste" (current) and "Barbecue" exist, **When** I choose
   "Barbecue" as current, **Then** the current list screen shows "Barbecue", and reopening the
   application shows "Barbecue".
4. **Given** "Lait" is ticked on "Ma liste", **When** I make "Barbecue" current, add "Lait" to
   it and tick nothing, **Then** "Lait" is unticked on "Barbecue" and still ticked on
   "Ma liste".
5. **Given** a list named "Barbecue" exists, **When** I try to create another list named
   "barbecue", **Then** no duplicate is created and I am told the name is already used.
6. **Given** I try to create a list with an empty or blank name, **When** I confirm, **Then**
   the list is not created and a French message asks for a name.
7. **Given** my lists are being read from the device, **When** the screen of my lists
   appears, **Then** a loading state is shown; if they cannot be read, an error state offers
   to retry and the error is reported.
8. **Given** several lists exist, **When** I open the screen of my lists, **Then** each list
   shows its name, its number of items, and which one is current.

---

### User Story 4 - Organize articles in categories (Priority: P3)

Articles always belong to one category. On first launch, the application already provides a
set of default categories. I can create my own categories to fit how I shop, and choose them
when I create an article.

**Why this priority**: categories make a long list readable in the store, but a list with
default categories is already usable; creating my own is a refinement.

**Independent Test**: on a fresh install, check the default categories exist; create a new
category, create an article in it, add it to the current list, and check it appears under
the new heading.

**Acceptance Scenarios**:

1. **Given** a fresh installation, **When** I look at the categories, **Then** the default
   categories listed in Assumptions are available, in that order.
2. **Given** I create the category "Bébé", **When** I next create an article, **Then** "Bébé"
   is offered as a category.
3. **Given** a category named "Boissons" exists, **When** I try to create "boissons",
   **Then** no duplicate is created and I am told the category already exists.
4. **Given** I try to create a category with an empty or blank name, **When** I confirm,
   **Then** the category is not created and a French message asks for a name.
5. **Given** a category holds no item of the current list, **When** I view the current list,
   **Then** that category heading is not shown.

---

### Edge Cases

- An item is removed while "Annuler" is still offered for another one: the offer now concerns
  the new removal only, and the earlier removal is final.
- Every item on the current list is ticked: the list stays as is until I finish shopping or
  untick items myself.
- No item of the list is ticked (including an empty list): "Terminer les courses" is hidden;
  it is shown as soon as at least one item is ticked.
- An article or a list is created while the device has no network: it is saved and shown
  immediately.
- The application is closed or killed right after a tick or a quantity change: the change is
  kept on reopening.
- Quantities with a decimal part are entered and shown with a decimal comma ("1,5 kg");
  a decimal point typed by the user is accepted and shown as a comma.
- Very long article, category or list names: names are limited to 60 characters and shown in
  full by wrapping, never cut off silently. Units are limited to 15 characters.
- Many items (200 or more) on one list: the list stays smooth to scroll and to tick.
- Device storage fails while saving a change: the change is not shown as saved, a French
  error message is shown, and the error is reported. A tick or untick is the exception: it is
  shown at once (FR-004), then returns to its previous state when the save fails, with the
  same message and report.

## Requirements *(mandatory)*

### Functional Requirements

**Current list and cart**

- **FR-001**: The application MUST open on the current shopping list and display its name.
- **FR-002**: Exactly one list MUST be current at any time.
- **FR-003**: A list MUST show its items grouped under their category headings, hiding
  categories that hold no item of the list.
- **FR-004**: Users MUST be able to tick an item (in the cart) and untick it (not in the
  cart) with a single tap, and the new state MUST be shown immediately.
- **FR-005**: Within a category, unticked items MUST be shown before ticked items.
- **FR-006**: A list MUST show how many of its items are left to put in the cart.
- **FR-007**: Users MUST be able to finish shopping on a list: after a confirmation, every item
  of that list is unticked and kept with its quantity. The action MUST be offered only while
  at least one item of the list is ticked.

**Editing a list**

- **FR-008**: Users MUST be able to add an existing article to a list, by browsing the catalog
  by category or by searching by name.
- **FR-009**: Search MUST match articles whose name contains the typed text, ignoring case
  and accents.
- **FR-010**: Users MUST be able to remove an item from a list without deleting the article
  from the catalog or from other lists. Removal MUST take effect immediately, without
  confirmation, and MUST be undoable through an "Annuler" action that restores the item with
  its quantity and ticked state. "Annuler" MUST be offered for 5 seconds; while a screen
  reader is on, it MUST stay offered until the user dismisses it or makes another change.
  Only the last removal can be undone: any other change (including a new removal or switching
  the current list) and closing the application end the offer, while moving between screens
  does not. A removal whose offer has ended is final.
- **FR-011**: An article MUST appear at most once on a given list; it may appear on several
  lists. When browsing or searching the catalog to add articles, articles already on the list
  MUST stay visible with an "already on the list" mark; choosing one MUST NOT duplicate or
  remove it, and MUST offer to change its quantity.
- **FR-012**: Items newly added to a list MUST be unticked.

**Quantities**

- **FR-013**: Articles in the catalog MUST NOT carry a quantity; a quantity belongs to an item
  on a given list.
- **FR-014**: When adding an article to a list, users MUST be able to give an optional
  quantity: a positive number (decimals allowed) with an optional free-text unit.
- **FR-015**: Users MUST be able to change or clear the quantity of an item already on a list.
- **FR-016**: A unit MUST NOT be accepted without a quantity; a quantity of zero, a negative
  quantity or a non-numeric quantity MUST be refused with a French message.
- **FR-017**: Quantities MUST be entered and displayed following French conventions (decimal
  comma).

**Articles and categories**

- **FR-018**: Users MUST be able to create an article with a name and exactly one category.
- **FR-019**: Users MUST be able to create a category with a name.
- **FR-020**: The application MUST provide the default categories listed in Assumptions on
  first launch.
- **FR-021**: Article names MUST be unique in the catalog, and category names unique among
  categories, comparing names case-insensitively and ignoring leading and trailing spaces.
- **FR-022**: Names (articles, categories, lists) MUST be non-blank, trimmed, and at most 60
  characters long; units at most 15 characters.

**Named lists**

- **FR-023**: On first launch, the application MUST create one empty list named "Ma liste" and
  make it current.
- **FR-024**: Users MUST be able to create further lists, each with a unique name (same
  uniqueness rule as FR-021).
- **FR-025**: Users MUST be able to see all their lists and choose which one is current; the
  choice MUST be kept across application restarts.
- **FR-026**: Each list MUST keep its own items, quantities and ticked states, independent of
  other lists.

**Offline, states, errors, language, accessibility**

- **FR-027**: All data MUST be stored on the device, and every feature of this spec MUST work
  without a network connection. No data is shared or synchronized with other devices or
  people in this feature.
- **FR-028**: Every change MUST be saved on the device as soon as it is made, with no explicit
  save action, and kept across application restarts.
- **FR-029**: Each screen showing data (current list, catalog by category, search results,
  lists) MUST implement explicit loading, empty, error and success states. Search results
  filter the catalog already loaded on the add screen: they share its loading and error
  states and have only their own empty and success states.
- **FR-030**: Every unexpected error MUST be shown to the user in plain French when it affects
  them, and reported to error tracking without any list content or personal data.
- **FR-031**: All user-facing text MUST be in French.
- **FR-032**: Every screen MUST be usable with the system screen reader: each interactive
  element has a French label, and each list item announces its name, its quantity when it has
  one, and whether it is in the cart.
- **FR-033**: Text MUST follow the system text size up to 200% without content being cut off
  or overlapping; long names wrap.
- **FR-034**: Every interactive element MUST have a touch target of at least 48 × 48 dp.
- **FR-035**: The ticked state MUST NOT be conveyed by color alone (for example, a check mark
  and struck-through text accompany any color change).
- **FR-036**: Every screen MUST meet WCAG 2.2 AA contrast in both the light and dark themes:
  at least 4.5:1 for text and 3:1 for icons, checkboxes and other meaningful graphics. Ticked
  rows are dimmed within these limits, never below them.
- **FR-037**: Screen reader focus MUST never be lost to the top of the screen after an action:
  an opening dialog takes focus, and on closing gives it back to the element that opened it;
  after an item is removed, focus moves to the next item of the list, or the previous one when
  there is no next, or the empty state when the list becomes empty; an item keeps focus when
  ticking or unticking it moves it within its category.
- **FR-038**: The screen reader MUST announce in French every snackbar (removal with
  "Annuler", article added, failed save) and every form error message as soon as it appears.
  The remaining count is not announced when it changes; it stays readable on the screen.

### Key Entities

- **Category**: a named group of articles (for example "Fruits et légumes"). Either provided
  by default or created by the user. Has a display order; user-created categories come after
  the default ones, in creation order.
- **Article**: something the user buys, identified by a unique name, belonging to exactly one
  category. Lives in the catalog independently of any list and has no quantity.
- **Catalog**: the set of all known articles, the source the user picks from to fill lists.
- **Shopping list**: a named list of items, with a unique name. Exactly one list is current.
- **List item**: the presence of an article on a list, with its in-cart state (ticked or
  unticked) and an optional quantity.
- **Quantity**: a positive number with an optional unit (for example "6", "500 g", "1,5 kg"),
  belonging to one list item.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From launch, the current list is readable and ready to tick in under 2 seconds.
- **SC-002**: A tick or untick is visible within 100 ms of the tap, with or without network.
- **SC-003**: From the add screen, adding an existing article to a list without a quantity
  takes at most 3 taps when browsing by category, or at most 3 taps and 3 typed letters when
  searching. Every tap counts, including the confirmation and tapping the search field;
  scrolling does not.
- **SC-004**: Creating a new article and adding it to a list with a quantity takes under 20
  seconds.
- **SC-005**: Switching the current list takes at most 2 taps from the current list screen.
- **SC-006**: 100% of the actions in this spec complete successfully with the device in
  airplane mode.
- **SC-007**: No change (tick, addition, removal, quantity, creation, current list choice) is
  lost after the application is closed, killed or the device restarted.
- **SC-008**: On a list of 200 items, scrolling and ticking stay at 55 frames per second or
  more, and each tick is shown within 100 ms.
- **SC-009**: Every action in this spec can be completed with the screen reader alone, and
  with the system text size at 200%.

SC-001, SC-002 and SC-008 are measured on a release build, on two reference phones: an
entry-level Android phone about five years old, and the maintainer's iPhone.

## Assumptions

- Single user on a single device; no account, sign-in, sharing or synchronization in this
  feature. Sharing a list with other people may come in a later feature.
- Default categories, in this order: Fruits et légumes, Boucherie et poissonnerie, Crèmerie,
  Boulangerie, Épicerie salée, Épicerie sucrée, Surgelés, Boissons, Hygiène et beauté,
  Entretien, Divers.
- The catalog starts empty: no default articles are provided, only default categories.
- The unit is free text (for example "g", "kg", "L", "paquets"); no unit conversion and no
  merging of quantities is done. Items carry no price or note in this feature.
- Renaming or deleting articles, categories and lists, and reordering categories, are out of
  scope for this feature. Editing and deleting articles is specified in
  [002-manage-articles](../002-manage-articles/spec.md). Since lists cannot be deleted, at least one list always exists.
- Categories are displayed in the order described for the Category entity above; items within a category
  are sorted alphabetically (French collation) inside the unticked and ticked groups.
