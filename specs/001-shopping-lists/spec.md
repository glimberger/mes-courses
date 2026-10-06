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
- Q: Can items be added, removed or changed only on the current list, or also on a list that
  is not current? → A: Only on the current list; to edit another list, the user makes it
  current first.
- Q: When are two article, category or list names the same name? → A: Ignoring case, leading
  and trailing spaces, repeated inner spaces and how an accented letter was typed (composed or
  not); accents still count, so "Pâte" and "Pâté" are different names.
- Q: What does the user see when the application cannot open, update or set up its storage at
  startup? → A: A full-screen French error state ("L'application n'a pas pu démarrer.") with
  "Réessayer"; the error is reported, and stored data is never deleted or reset automatically.
- Q: Until server synchronization (003) ships, what happens to the data if the phone is lost,
  reset or the application uninstalled? → A: The loss is an accepted risk until 003; the system
  backup (Android Auto Backup, iCloud device backup) stays on as a fallback, and no encryption
  is added beyond the system's own, because the data is not sensitive.
- Q: What limits and format apply to a quantity's number? → A: Digits with at most one decimal
  comma or point, at most 3 decimals and at most 9 999; spaces, signs and exponents are
  refused; shown without trailing zeros ("1,50" → "1,5").
- Q: If saving fails when the user taps "Annuler" to bring back a removed item, what happens?
  → A: The item stays removed, the undo offer ends, the usual failed-save message is shown and
  the error is reported.
- Q: If saving fails after the user confirms "Terminer les courses", what does the user see?
  → A: No item changes (all or nothing); the dialog closes, the usual failed-save message is
  shown, the error is reported, and "Terminer les courses" stays available.
- Q: When the same item is tapped several times before earlier saves finish and one save fails,
  which state does it return to? → A: Every tap is shown at once and saved in tap order; on a
  failure the item shows the state last saved on the device, with the usual message and report.
- Q: What must happen to stored data when the application is updated, and when an older
  version opens data saved by a newer one? → A: Every update keeps all data, upgrading the
  storage in place (a failure shows the FR-039 error); an older version leaves newer data
  untouched and asks in French to update the application.
- Q: Can a storage error report include the error's own text, which may quote the value being
  saved? → A: No: storage error reports keep the error type, error code, stack trace,
  operation and screen; the error's text is removed before sending.
- Q: Must a saved change survive a device restart or a sudden power loss, not only the
  application being killed? → A: Yes: once a change is shown as saved, it survives application
  restarts, device restarts and sudden power loss (FR-028, SC-007).
- Q: Is every user action saved all or nothing, including actions that change several things,
  such as creating an article and adding it to the list? → A: Yes: a failed save keeps none of
  the action's changes; the article is neither created nor added (FR-028).
- Q: Which changes does SC-007 protect: does it include undoing a removal, creating a category
  and finishing shopping? → A: Every kind of change the spec allows, each named in SC-007,
  undo of a removal, category creation and finishing shopping included.
- Q: When a save fails because the device storage is full, does the user get the usual
  failed-save message or a message of its own? → A: A message of its own: "Espace de stockage
  insuffisant. Libérez de la place sur votre téléphone."; the change is handled like any failed
  save, and the error is not reported because it is expected (FR-030).
- Q: Why is exactly one list always current? → A: The first launch makes "Ma liste" current,
  choosing another list replaces it, and lists cannot be deleted in this feature; FR-002 now
  states these three rules together.
- Q: What counts as a first launch, and what if it is interrupted? → A: First launch means no
  list is stored yet, so reinstalling or clearing the application's data sets up again and
  existing data is never set up twice; the default categories and "Ma liste" are set up all or
  nothing, and an interrupted first launch is redone at the next launch (FR-023).
- Q: Which actions do SC-006 (airplane mode) and SC-009 (screen reader, 200% text) cover? → A:
  One shared list of the 12 actions of this spec, written under the Success Criteria.
- Q: Does the spec record that keeping all data on the device departs from constitution
  Principle VII? → A: Yes: FR-027 names the deviation and points to the plan's Complexity
  Tracking and to 003-server-sync, which closes it.
- Q: What data size must the application handle? → A: Up to 1 000 articles in the catalog, 20
  lists and 200 items per list, with SC-001 and SC-008 holding at that size (Assumptions).
- Q: In quick taps on one item, when a save in the middle fails, are the later taps still saved?
  → A: No: taps still waiting behind the failed save are dropped; the item shows the state last
  saved on the device, and only taps made after the failure are saved (FR-004).
- Q: Does sending the application to the background end the "Annuler" offer, or only stopping
  it? → A: Only stopping it (swiped away or killed by the system); in the background the offer
  stays while its time limit lasts (FR-010).
- Q: Must a tick survive a kill or power loss that happens before its save has finished, given
  it is shown at once? → A: No: a change is protected once its save on the device has finished;
  a tick lost because the application stopped before its save finished is accepted (FR-028,
  SC-007).
- Q: In which order are search results shown on the add screen? → A: Like browsing: under their
  category headings in category order, sorted alphabetically (French collation) within each
  category; categories with no match are not shown (FR-009).
- Q: How are criteria that no automated test can check verified (timings, frame rate, screen
  reader, 200% text, contrast, power loss)? → A: The spec lists them; each gets a written
  manual check (steps and expected result) run before release; every other requirement and
  scenario needs an automated test (Success Criteria).
- Q: Must every tick and every moment of scrolling meet SC-002 and SC-008, or a stated share?
  → A: A stated share: 95% of 50 ticks shown within 100 ms; over a 10-second scroll of the
  200-item list, at least 55 frames per second on average with at most 5% of frames dropped.
- Q: Does the fixed list of report fields apply to every error report, not only storage errors?
  → A: Yes: every report keeps only the error type, error code, stack trace, operation, screen,
  application version, device model and system version, and the environment (production or
  preview, as clarified below); the error's own text is removed
  from every report, and no list, article or category name ever appears (FR-030).
- Q: How does search treat a blank query, spaces in the query, and "œ" and "æ"? → A: The query
  is cleaned like a name (trimmed, inner spaces reduced); a query left empty shows the full
  catalog as if nothing were typed; "œ" and "æ" match "oe" and "ae" both ways (FR-009).
- Q: When does SC-001's 2-second clock start and stop? → A: Cold start only: from the icon tap,
  with the application fully stopped, until the current list (200 items, 1 000-article
  catalog) is shown and a tap ticks an item; at least 9 of 10 launches under 2 seconds.
- Q: Do scenarios keep their numbers when one is added or removed? → A: Yes: a scenario is cited
  as "US<story>-<n>" and its number never changes; a new scenario takes the next free number at
  the end of its story, and a removed one leaves its number unused, marked "Removed".
- Q: Must every rule stated only in an FR or the Edge Cases get its own Given/When/Then
  scenario? → A: No: an FR is a test anchor like a scenario; every FR and every scenario is
  cited by at least one test name (or a manual check for the listed exceptions), and each Edge
  Case names the FR that holds its rule (Success Criteria).
- Q: Are the amounts ",5", "5,", "007" and "0,000" accepted? → A: Digits must appear on both
  sides of the separator: ",5" and "5," are refused with the format message; "007" is accepted
  as 7; "0,000" is refused as not positive (FR-016).
- Q: In what order are lists shown on the screen of my lists? → A: Alphabetically by name
  (French collation), the current list in its place with its mark (US3-8).
- Q: How is a unit cleaned? → A: Like a name: trimmed, inner spaces reduced to one; a unit
  empty after cleaning means no unit, with no error; the 15-character limit applies after
  cleaning (FR-022).
- Q: How does the "Annuler" offer behave when the screen reader is turned on or off while it
  shows? → A: It follows the current setting: turned on, the offer stays with no limit; turned
  off, the 5 seconds count from the removal again, so an offer older than 5 seconds ends at
  once (FR-010).
- Q: On how large a list is SC-002 measured? → A: At full data size: a 200-item current list
  and a 1 000-article catalog, on the same release build as SC-001 and SC-008.
- Q: Who performs SC-004, and with what? → A: The maintainer, already familiar with the app, on
  a reference phone, typing included: 3 tries, each with a new article in "Épicerie salée" with
  "400 g" ("Pois chiches", "Lentilles", "Haricots rouges"), each under 20 seconds.
- Q: Which color pairs must FR-036's contrast rule be checked on? → A: Every foreground color
  the screens use (text, icons, checkbox, outline) against every background color it is drawn
  on, in light and dark; the theme test computes all of them, and a new role a screen uses
  joins the check (FR-036).
- Q: Does search ignore every mark on a letter, cedilla and diaeresis included? → A: Yes:
  accents, cedilla, diaeresis and tilde are all ignored ("francais" finds "Français", "mais"
  finds "Maïs"), with the œ and æ rule (FR-009).
- Q: Does the spec name the operation and screen of each reported error? → A: No: each report
  names the failed operation and the screen it happened on; the exact names are set in the UI
  contract (contracts/ui-screens.md), which tests use (FR-030).
- Q: Must scenarios that test two behaviors (US3-7, US2-6) be split? → A: No: a scenario may be
  proven by several tests, each citing its id, and every behavior in its "Then" is covered by at
  least one of them.
- Q: Is a successful "Réessayer" stated as a requirement? → A: Yes, once in FR-029 and FR-039:
  "Réessayer" reads again, and when reading succeeds the loaded screen replaces the error state;
  tests cite the FR.
- Q: How is a full device storage told apart from other storage failures? → A: The device
  storage itself reports that no space is left; any other storage failure is unexpected and
  reported. The exact signal is set in the plan, and tests simulate it through a storage double
  (FR-030).
- Q: Which device settings does a scenario assume unless it says otherwise? → A: Screen reader
  off, network on, system text at 100% and the light theme; a scenario that depends on another
  setting states it in its "Given".
- Q: Besides the error itself, may a report identify the person or the device? → A: No: a report
  carries no user identifier, no installation identifier and no device name; the device model
  (for example "Pixel 6") is the only device detail kept (FR-030). A crash in native code is the
  one exception, clarified below.
- Q: When an error happens without network, what happens to its report? → A: It is stored on
  the phone, at most 30 reports, kept across application stops and device restarts, and sent
  when the network returns; when the queue is full, the oldest report is dropped (FR-030a).
- Q: When a screen fails unexpectedly while it is being drawn, what does the user see? → A: A
  full-screen French error "Une erreur est survenue." with "Réessayer", which starts the
  application again as in FR-039; the error is reported and stored data is never deleted
  (FR-039a).
- Q: Must a report from a release build show a readable stack trace, and is that checked by
  hand? → A: Yes: the stack trace names the source files and functions, not minified code; a
  manual check before release sends a test report, then one raised in airplane mode, and finds
  both readable after reconnection (FR-030, FR-030a).
- Q: Are users told that errors are sent to an outside service, and can they turn it off? → A:
  No notice and no setting in the application; if it is published on a store, its privacy
  details declare crash data collected without identifiers (Assumptions).
- Q: Must crashes in the phone's native code (outside the application's JavaScript) be
  reported, given their reports cannot be stripped of identifiers? → A: Yes, as an exception to
  FR-030: such a report may carry the random installation identifier the error tracking tool
  sets, which changes when the application is reinstalled; it still carries no list content,
  no user identifier and no device name (FR-030, Assumptions).
- Q: Which builds send reports, and under which environment name? → A: Store releases send as
  "production" and test builds installed on a phone (internal or preview) as "preview";
  development runs and automated test builds never send anything (FR-030).
- Q: When the same failure repeats many times, is each occurrence reported? → A: No: a failure
  with the same error type, error code, operation and screen is reported at most once from the
  moment the application is opened until it is stopped ("Réessayer" does not reopen it); any
  other failure is always reported, and nothing is sampled (FR-030).
- Q: Does the spec list every expected situation, which is never reported? → A: Yes, a closed
  list in FR-030: a full device storage, data saved by a newer version (FR-040), and input
  refused with a French message (a name empty, too long or already used, an invalid quantity or
  unit); every other failure is unexpected and reported (FR-030).
- Q: How does a report identify the application version? → A: By the version and the build
  number together, for example "1.2.0 (42)"; each build has its own number (FR-030).
- Q: Do these report rules apply to every report the application sends, including those added
  by 002 and 003? → A: Yes: FR-030 and FR-030a are the rules for every report the application
  sends, whatever the feature; later features cite them and only add their own expected
  situations; the server's reports keep their own rules (003 FR-022a) (FR-030b).
- Q: How does the maintainer find out that a new error has appeared? → A: By email, the first
  time a new kind of failure appears in "production" and when a failure marked as fixed comes
  back; repeats and "preview" reports send nothing (FR-030c).
- Q: How quickly must a report reach error tracking? → A: Within 1 minute of the error with the
  network on, of the network returning while the application is open, or of the next opening
  after a native crash (SC-010).
- Q: Apart from the composition root, may one adapter import code from another adapter, and
  does the application's entry point count as part of the composition root? → A: Adapters never
  import each other; the entry point counts as the composition root, the only code that knows
  every adapter; an error the user interface must recognize (a full device storage, data saved
  by a newer version) is declared with the application's ports (plan, research R15).
- Q: What may the domain and application layers import from outside their own folders? → A: No
  outside library at all, not even its types; the only exception, from 003 on, is a shared
  package of the repository marked pure (no framework, no side effects, importing only other
  pure shared packages) (plan, research R15).
- Q: Which failures does an action return rather than throw, and is a returned failure that no
  input can cause reported? → A: Every broken business rule is returned, never thrown, by
  actions and business rules alike; only technical failures are thrown. Refused input (and
  "already on the list", US2-8) is shown and never reported; any other returned failure (a
  missing record, the wrong state) shows the usual failed-save message and is reported, with
  its kind as the error code (FR-030).
- Q: What styling may a screen define itself? → A: Layout only (flex, alignment, position, and
  margins, padding and gaps taken from spacing tokens); colors, fonts, borders, radius, shadow
  and raw numbers are refused, and anything visual goes into a shared component (plan, research
  R2).
- Q: Are the theme's medium- and high-contrast color variants used in this feature? → A: No:
  only the light and dark themes are built and checked (FR-036); the variants stay in the theme
  file until a feature selects them (plan, research R2).
- Q: When "Terminer les courses" is confirmed, or an item removed, while ticks on that list are
  still being saved, in which order are the changes saved? → A: Every save follows the order the
  user made the changes, across items and actions: the action is saved after the ticks made
  before it; if one of those ticks fails, the later action is still saved, and only that tick
  returns to its stored state (FR-004).
- Q: Does a tick or untick end the "Annuler" offer, and does a refused input or a failed save?
  → A: Every saved change ends it, ticks and unticks included; a refused input or the failed save
  of another change changes nothing and leaves the offer as it was; a failed "Annuler" still ends
  it (FR-010).
- Q: Are names differing only by "œ"/"oe", "æ"/"ae" or a straight or curly apostrophe (' ’) the
  same name? → A: Yes: these pairs are equal for uniqueness, as for search, so "Oeufs" and
  "Œufs" cannot both exist; accents still count ("Pâte" ≠ "Pâté") (FR-021, FR-009).
- Q: Are the expected data sizes limits the application enforces? → A: No: they are the sizes
  SC-001, SC-002 and SC-008 are measured at; nothing is refused beyond them, and performance is
  not promised beyond them (Assumptions).
- Q: From the add screen, can the user always start creating an article, even when the search
  finds matches, and is the search text used as its name? → A: Yes: creating an article is
  always offered on the add screen, and its name is prefilled with the search text cleaned like
  a name (FR-008, US2-19).

## User Scenarios & Testing *(mandatory)*

Acceptance scenarios are cited as "US<story>-<n>" (for example US2-16, the sixteenth scenario
of User Story 2). A scenario's number never changes: a new scenario takes the next free number
at the end of its story, and a removed scenario keeps its number, marked "Removed", so
references in contracts, tasks and tests stay valid.

Unless a scenario says otherwise, the device has the screen reader off, the network on, the
system text size at 100% and the light theme; a scenario that depends on another setting states
it in its "Given".

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
5. **Given** "Farine" is on the list "Courses de la semaine" with "2 kg", **When** I make
   "Gâteau" current and add "Farine" to it with "500 g", **Then** each list keeps its own
   quantity.
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
    shown under their category heading, in that order; typing "oeuf" finds "Œufs", and a
    query of spaces only shows the full catalog.
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
19. **Given** the catalog holds "Pâte" and I search " pâté ", **When** "Pâte" is shown and I
    choose to create a new article, **Then** the article form opens with the name "pâté", and
    confirming with a category creates "pâté" and adds it to the current list.

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
   shows its name, its number of items, and which one is current, and the lists are sorted
   alphabetically by name (French collation), the current one included.

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
  the new removal only, and the earlier removal is final (FR-010).
- Every item on the current list is ticked: the list stays as is until I finish shopping or
  untick items myself (FR-006, FR-007).
- No item of the list is ticked (including an empty list): "Terminer les courses" is hidden;
  it is shown as soon as at least one item is ticked (FR-007).
- An article or a list is created while the device has no network: it is saved and shown
  immediately (FR-027).
- The application is closed or killed right after a tick or a quantity change: the change is
  kept on reopening once its save has finished; a tick whose save had not finished yet may be
  lost (FR-028).
- Quantities with a decimal part are entered and shown with a decimal comma ("1,5 kg");
  a decimal point typed by the user is accepted and shown as a comma. Trailing zeros are
  dropped ("1,50" is shown "1,5"); more than 3 decimals or a value above 9 999 is refused
  (FR-016, FR-017).
- Very long article, category or list names: names are limited to 60 characters and shown in
  full by wrapping, never cut off silently. Units are limited to 15 characters (FR-022,
  FR-033).
- Many items (200 or more) on one list: scrolling and ticking meet SC-008.
- The application cannot open, update or set up its storage at startup: a full-screen error
  state says "L'application n'a pas pu démarrer." and offers "Réessayer", the error is
  reported, and stored data is never deleted or reset automatically (FR-039).
- An older version of the application finds data saved by a newer one (a developer install or
  a restored backup): it leaves the data untouched and shows a full-screen message "Cette
  version de l'application est trop ancienne pour vos données. Mettez-la à jour." (FR-040).
- Device storage fails while saving a change: the change is not shown as saved, a French error
  message is shown, and the error is reported (FR-028, FR-030). A tick or untick is the
  exception: it is shown at once (FR-004), then returns to the state last saved on the device
  when the save fails, with the same message and report. Repeated taps on one item are each
  shown at once and saved in tap order; when one of them fails, the taps still waiting behind it
  are dropped, so the item shows what is stored (for example: tick saved, untick fails, a third
  tap waiting is dropped, and the item shows ticked). "Terminer les courses" or a removal made
  while ticks are still being saved is saved after them; if one of those ticks fails, the action
  is still saved (FR-004). A failed "Annuler" leaves the item removed
  and ends the undo offer, with the same message and report (FR-010). A failed "Terminer les
  courses" changes no item: the dialog closes, with the same message and report, and the action
  stays offered (FR-007).
- The device storage is full when saving a change: the save fails as above, but the message is
  "Espace de stockage insuffisant. Libérez de la place sur votre téléphone." instead of the
  usual failed-save message, and the error is not reported (FR-030).
- A screen fails unexpectedly while it is being drawn (not while loading data or saving): a
  full-screen error state says "Une erreur est survenue." and offers "Réessayer", the error is
  reported, and stored data is never deleted (FR-039a).

## Requirements *(mandatory)*

### Functional Requirements

**Current list and cart**

- **FR-001**: The application MUST open on the current shopping list and display its name.
- **FR-002**: Exactly one list MUST be current at any time: the first launch makes "Ma liste"
  current (FR-023), choosing another list replaces it (FR-025), and lists cannot be deleted in
  this feature (Assumptions).
- **FR-003**: A list MUST show its items grouped under their category headings, hiding
  categories that hold no item of the list.
- **FR-004**: Users MUST be able to tick an item (in the cart) and untick it (not in the
  cart) with a single tap, and the new state MUST be shown immediately. Taps MUST be saved in
  the order they were made; when a save fails, the item MUST show the state last saved on the
  device, and taps on that item still waiting to be saved MUST be dropped. Only taps made after
  the failure are saved. Every change, not only taps, MUST be saved in the order the user made
  it: "Terminer les courses" (FR-007) or a removal (FR-010) is saved after the ticks made before
  it, and a failed tick drops only taps on that item, never a later action of another kind. A
  removal saved after a failed tick keeps, for "Annuler", the ticked state stored on the device.
- **FR-005**: Within a category, unticked items MUST be shown before ticked items.
- **FR-006**: A list MUST show how many of its items are left to put in the cart.
- **FR-007**: Users MUST be able to finish shopping on a list: after a confirmation, every item
  of that list is unticked and kept with its quantity, all or nothing: if saving fails, no item
  changes. The action MUST be offered only while
  at least one item of the list is ticked.

**Editing a list**

- **FR-008**: Users MUST be able to add an existing article to the current list, by browsing the
  catalog by category or by searching by name. Items are added, removed, ticked and have their
  quantity changed only on the current list; to edit another list, the user makes it current
  first (FR-025). Creating a new article (FR-018) MUST be offered on the add screen at all
  times, whether or not a search finds matches; when a search text is typed, the new article's
  name is prefilled with it, cleaned as in FR-022.
- **FR-009**: Search MUST match articles whose name contains the typed text, ignoring case and
  every mark added to a letter (accents, cedilla, diaeresis, tilde: "francais" finds "Français",
  "mais" finds "Maïs"), with "œ" and "æ" matching "oe" and "ae" both ways ("oeuf" finds "Œufs")
  and a straight apostrophe matching a curly one both ways ("d'amande" finds "Pâte d’amande").
  The typed text is first trimmed, with repeated inner spaces reduced to one; when nothing is
  left, the full catalog is shown as if nothing were typed. Results MUST be shown like the
  browsed catalog: under their category headings in category order, sorted alphabetically
  (French collation) within each category, with categories holding no match left out.
- **FR-010**: Users MUST be able to remove an item from a list without deleting the article from
  the catalog or from other lists. Removal MUST take effect immediately, without confirmation,
  and MUST be undoable through an "Annuler" action that restores the item with its quantity and
  ticked state. "Annuler" MUST be offered for 5 seconds; while a screen reader is on, it MUST
  stay offered until the user dismisses it or makes another change. The offer follows the
  current setting: when the screen reader is turned off during an offer, the 5 seconds count
  from the removal, so an offer older than 5 seconds ends at once. Only the last removal can be
  undone: any other change (any change the user makes that is saved, including a tick or untick,
  a new removal or switching the current list) and stopping
  the application (swiped away or killed by the system) end the offer, while moving between
  screens or sending the application to the background does not; the 5-second limit keeps
  running in the background. A refused input (FR-016, FR-022) or the failed save of another
  change changes nothing and does not end the offer. A removal whose offer has ended is final. If restoring the item
  fails, it stays removed and the offer ends; the failed save is handled as in Edge Cases.
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
  quantity or a non-numeric quantity MUST be refused with a French message. A quantity MUST be
  written with digits and at most one decimal comma or point, with digits on both sides of it,
  at most 3 decimals and a value of at most 9 999; spaces, signs, exponents and a separator
  with no digit on one side ("1 000", "+2", "1e3", ",5", "5,") MUST be refused with a French
  message stating the rule. Leading zeros are accepted ("007" is 7), and an amount equal to
  zero ("0,000") is refused as not positive.
- **FR-017**: Quantities MUST be entered and displayed following French conventions (decimal
  comma), without trailing zeros: "1,50" is shown "1,5", and "2,0" is shown "2".

**Articles and categories**

- **FR-018**: Users MUST be able to create an article with a name and exactly one category.
- **FR-019**: Users MUST be able to create a category with a name.
- **FR-020**: The application MUST provide the default categories listed in Assumptions on
  first launch.
- **FR-021**: Article names MUST be unique in the catalog, and category names unique among
  categories. Two names are the same when they match ignoring case, leading and trailing
  spaces, repeated inner spaces, how an accented letter was typed (one composed character
  or a letter followed by an accent mark), "œ" or "oe", "æ" or "ae", and a straight or curly
  apostrophe (' or ’): "Oeufs" and "Œufs" are the same name. Accents count: "Pâte" and "Pâté" are different
  names.
- **FR-022**: Names (articles, categories, lists) MUST be non-blank, trimmed, with repeated
  inner spaces reduced to one, and at most 60 characters long. Units MUST be cleaned the same
  way and be at most 15 characters long after cleaning; a unit left empty by cleaning means no
  unit, with no error.

**Named lists**

- **FR-023**: On first launch, the application MUST create one empty list named "Ma liste" and
  make it current. First launch means no list is stored yet (after installing, reinstalling or
  clearing the application's data); when a list already exists, nothing is created again.
  Setting up the default categories (FR-020) and "Ma liste" MUST be all or nothing: an
  interrupted first launch leaves nothing set up, and the next launch sets everything up again.
- **FR-024**: Users MUST be able to create further lists, each with a unique name (same
  uniqueness rule as FR-021).
- **FR-025**: Users MUST be able to see all their lists and choose which one is current; the
  choice MUST be kept across application restarts.
- **FR-026**: Each list MUST keep its own items, quantities and ticked states, independent of
  other lists.

**Offline, states, errors, language, accessibility**

- **FR-027**: All data MUST be stored on the device, and every feature of this spec MUST work
  without a network connection. No data is shared or synchronized with other devices or
  people in this feature. This departs from constitution Principle VII (remote source of
  truth): the deviation is justified in [plan.md](plan.md) (Complexity Tracking) and closed by
  [003-server-sync](../003-server-sync/spec.md).
- **FR-028**: Every change MUST be saved on the device as soon as it is made, with no explicit
  save action, and kept across application restarts, device restarts and sudden power loss
  (for example an empty battery): once its save on the device has finished, a change is never
  lost. A tick or untick is shown before its save finishes (FR-004); if the application stops
  in that short time, losing it is accepted. Every user
  action MUST be saved all or nothing: when an action changes several things (for example
  creating an article and adding it to the current list, or finishing shopping), a failed save
  keeps none of its changes.
- **FR-029**: Each screen showing data (current list, catalog by category, search results,
  lists) MUST implement explicit loading, empty, error and success states. Search results
  filter the catalog already loaded on the add screen: they share its loading and error
  states and have only their own empty and success states. The error state's "Réessayer" MUST
  read again: when reading succeeds, the loaded screen (empty or success) replaces the error
  state; when it fails again, the error state stays and the error is reported again, unless
  FR-030's once-per-opening rule applies.
- **FR-030**: Every unexpected error MUST be shown to the user in plain French when it affects
  them, and reported to error tracking without any list content or personal data. Every report
  MUST keep only the error type, the error code, the stack trace, the operation, the screen, the
  application version (the version and the build number, for example "1.2.0 (42)", each build
  having its own number), the device model and system version, and the environment: "production"
  for a store release, "preview" for a test build installed on a phone. Development runs and
  automated test builds MUST NOT send any report. In a release build, the stack trace MUST name
  the source files and functions, not minified code. The error's own text, which may quote a value being saved or shown, MUST be
  removed before sending, and no list, article or category name may appear in a report. A
  report MUST NOT carry any user identifier, installation identifier or device name (the name
  the owner gave the phone); the device model is the only device detail kept. The one exception
  is a crash in native code (outside the application's JavaScript): it MUST be reported too,
  and its report may carry a random installation identifier, which changes when the application
  is reinstalled, but no other identifier, no device name and no list content. A failure with
  the same error type, error code, operation and screen as one already reported MUST NOT be
  reported again until the application is stopped and opened again ("Réessayer" does not reopen
  it); any other failure is always reported, and reports are never sampled. Each
  report names the failed operation and the screen it happened on; their exact names are set in
  [contracts/ui-screens.md](contracts/ui-screens.md). A save that fails because the device
  storage is full (the storage itself reports that no space is left; any other storage failure
  is unexpected) is an expected situation, not an unexpected error: it MUST show "Espace de
  stockage insuffisant. Libérez de la place sur votre téléphone." and MUST NOT be reported.
  In this feature, the expected situations, never reported, are exactly these three: a full device storage,
  data saved by a newer version of the application (FR-040), and input refused with a French
  message (a name empty, too long or already used, FR-021 and FR-022; an invalid quantity or
  unit, FR-016 and FR-022). Every other failure is an unexpected error. Being told an article
  is already on the list (FR-011, US2-8) is a choice offered, not a failure.
- **FR-030a**: A report raised without network MUST be stored on the device and sent when the
  network returns. At most 30 reports are kept; when a new report would exceed that, the oldest
  one is dropped. Stored reports MUST survive the application being stopped and the device
  being restarted.
- **FR-030b**: FR-030 and FR-030a apply to every report the application sends, including those
  of later features ([002-manage-articles](../002-manage-articles/spec.md),
  [003-server-sync](../003-server-sync/spec.md)). A later feature MUST cite them rather than
  restate them, and MAY only add expected situations of its own, each named in its spec (for
  example being offline or the server being unreachable, 003 FR-022). Reports sent by the
  server follow 003 FR-022a.
- **FR-030c**: The maintainer MUST receive an email the first time a new kind of failure (same
  error type, error code, operation and screen) is reported from a "production" build, and when
  a failure the maintainer marked as fixed is reported again. Further reports of a known
  failure and every "preview" report MUST NOT send an email. This is a setting of the error
  tracking service, checked once when it is set up.
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
  rows are dimmed within these limits, never below them. The rule applies to every foreground
  color the screens use (text, icons, checkbox, outline) against every background color it is
  drawn on, in both themes, and is checked by computing each pair from the theme colors.
- **FR-037**: Screen reader focus MUST never be lost to the top of the screen after an action:
  an opening dialog takes focus, and on closing gives it back to the element that opened it,
  or to the screen title when that element is gone (for example "Terminer les courses", hidden
  once every item is unticked);
  after an item is removed, focus moves to the next item of the list, or the previous one when
  there is no next, or the empty state when the list becomes empty; an item keeps focus when
  ticking or unticking it moves it within its category.
- **FR-038**: The screen reader MUST announce in French every snackbar (removal with
  "Annuler", article added, failed save) and every form error message as soon as it appears.
  The remaining count is not announced when it changes; it stays readable on the screen.
- **FR-039**: When the application cannot open, update or set up its storage at startup, it
  MUST show a full-screen error state in French with a "Réessayer" action and report the
  error. "Réessayer" MUST start the application again: when it succeeds, the current list is
  shown; when it fails again, the error state stays and the error is reported again, unless
  FR-030's once-per-opening rule applies. It MUST
  NOT delete, reset or overwrite stored data to recover.
- **FR-039a**: When a screen fails unexpectedly while it is being drawn, the application MUST
  show a full-screen error state in French, "Une erreur est survenue.", with a "Réessayer"
  action, and report the error. "Réessayer" MUST start the application again as in FR-039, and
  stored data MUST NOT be deleted, reset or overwritten. Unexpected errors that no screen or use
  case catches (uncaught exceptions, unhandled promise rejections) MUST be reported too.
- **FR-040**: Every update of the application MUST keep all stored data (lists, items, ticks,
  quantities, articles, categories, current list), upgrading how it is stored in place when
  needed; a failed upgrade is handled by FR-039. When an older version finds data saved by a
  newer one, it MUST NOT read, change or delete it, and MUST show a full-screen French message:
  "Cette version de l'application est trop ancienne pour vos données. Mettez-la à jour." This
  is an expected situation, not an error, and is not reported.

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

- **SC-001**: From the tap on the application icon, with the application fully stopped (cold
  start), the current list is shown and a tap ticks an item in under 2 seconds, for at least
  9 of 10 launches, with a 200-item current list and a 1 000-article catalog.
- **SC-002**: A tick or untick is visible within 100 ms of the tap, with or without network,
  for at least 95% of 50 ticks and unticks in a row, on a 200-item current list with a
  1 000-article catalog.
- **SC-003**: From the add screen, adding an existing article to a list without a quantity
  takes at most 3 taps when browsing by category, or at most 3 taps and 3 typed letters when
  searching. Every tap counts, including the confirmation and tapping the search field;
  scrolling does not.
- **SC-004**: Creating a new article and adding it to a list with a quantity takes under 20
  seconds, from tapping "Ajouter" on the current list until the item shows on it, typing
  included. Measured by the maintainer, already familiar with the app, on a reference phone,
  with 3 tries, each creating a new article in "Épicerie salée" with "400 g" ("Pois chiches",
  "Lentilles", "Haricots rouges"), each under 20 seconds.
- **SC-005**: Switching the current list takes at most 2 taps from the current list screen.
- **SC-006**: 100% of the actions of this spec (listed below) complete successfully with the
  device in airplane mode.
- **SC-007**: No change (tick or untick, addition, removal, undo of a removal, quantity set,
  changed or cleared, creation of an article, a category or a list, finishing shopping, current
  list choice) whose save on the device has finished is lost after the application is closed,
  killed, the device restarted or its power suddenly lost.
- **SC-008**: On a list of 200 items, a 10-second scroll and 50 ticks run at 55 frames per
  second or more on average, with at most 5% of frames dropped, and at least 95% of the ticks
  are shown within 100 ms.
- **SC-009**: Every action of this spec (listed below) can be completed with the screen reader
  alone, and with the system text size at 200%.
- **SC-010**: A report reaches error tracking within 1 minute: of the error, when the network is
  on; of the network returning, while the application is open; of the next opening of the
  application, after a crash in native code (FR-030, FR-030a).

SC-001, SC-002 and SC-008 are measured on a release build, on two reference phones: an
entry-level Android phone about five years old, and the maintainer's iPhone.

Every requirement and acceptance scenario of this spec is proven by an automated test, except
the following, which each get a written manual check (steps and expected result) run on the
reference phones before release: SC-001, SC-002, SC-004, SC-008, SC-009 and SC-010; the device restart
and sudden power loss cases of SC-007; text at 200% (FR-033); contrast as seen on screen
(FR-036); screen reader focus and announcements (FR-037, FR-038); and error tracking on a
release build: a test report arrives with a readable stack trace, a report raised in airplane
mode arrives after reconnection, and a test crash in native code arrives with no device name
and no identifier other than the installation one (FR-030, FR-030a); and, once when error
tracking is set up, the email alerts of FR-030c. Parts of these that an
automated test can check (for example French labels or the contrast of theme colors) are still
tested automatically.

A functional requirement is a test anchor just like an acceptance scenario: every FR and every
scenario MUST be cited by at least one test name ("FR-016 …", "US2-12 …"), or by a manual check
for the exceptions above. A scenario may be proven by several tests, each citing its id, as
long as every behavior in its "Then" is covered by at least one of them. A rule stated only in
an FR needs no Given/When/Then scenario of its own, and each Edge Case names the FR that holds
its rule.

The actions of this spec, checked one by one by SC-006 and SC-009:

1. Open the application on the current list.
2. Tick and untick an item.
3. Finish shopping ("Terminer les courses").
4. Add an existing article to the current list, by browsing categories and by searching.
5. Create an article and add it to the current list.
6. Set, change and clear the quantity of an item.
7. Remove an item from the current list.
8. Undo a removal ("Annuler").
9. See all lists.
10. Create a list.
11. Choose the current list.
12. Create a category.

## Assumptions

- Single user on a single device; no account, sign-in, sharing or synchronization in this
  feature. Sharing a list with other people may come in a later feature.
- Until server synchronization ([003-server-sync](../003-server-sync/spec.md)) ships, the
  device holds the only copy of the data: losing, resetting the phone or uninstalling the
  application loses it, an accepted risk. The application's data stays included in the system
  backup (Android Auto Backup, iCloud device backup) as a fallback. Lists hold no sensitive
  data, so no encryption is added beyond the system's own.
- Error reports go to an outside error tracking service without the user being told in the
  application, and cannot be turned off: they hold no list content and no personal data, and
  only native crash reports carry an identifier, a random one per installation (FR-030). If the
  application is published on a store, its privacy details declare crash data and that random
  installation identifier, neither linked to the user nor used for tracking.
- Default categories, in this order: Fruits et légumes, Boucherie et poissonnerie, Crèmerie,
  Boulangerie, Épicerie salée, Épicerie sucrée, Surgelés, Boissons, Hygiène et beauté,
  Entretien, Divers.
- The catalog starts empty: no default articles are provided, only default categories.
- Expected data size: up to 1 000 articles in the catalog, 20 lists and 200 items per list;
  SC-001, SC-002 and SC-008 must hold at that size. These are measurement sizes, not limits:
  nothing is refused beyond them, and performance is not promised beyond them.
- The unit is free text (for example "g", "kg", "L", "paquets"); no unit conversion and no
  merging of quantities is done. Items carry no price or note in this feature.
- Renaming or deleting articles, categories and lists, and reordering categories, are out of
  scope for this feature. Editing and deleting articles is specified in
  [002-manage-articles](../002-manage-articles/spec.md). Since lists cannot be deleted, at least
  one list always exists.
- Categories are displayed in the order described for the Category entity above; items within a
  category are sorted alphabetically (French collation) inside the unticked and ticked groups.
  On the add screen, articles within a category are sorted alphabetically (French collation),
  when browsing and when searching. Lists on the screen of my lists are sorted alphabetically by
  name (French collation).
