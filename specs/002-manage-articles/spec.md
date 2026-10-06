# Feature Specification: Manage Articles

**Feature Branch**: `feat/002-manage-articles`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "renommer ou supprimer des articles"

**Depends on**: [001-shopping-lists](../001-shopping-lists/spec.md) (catalog, articles,
categories, lists and list items).

## Clarifications

### Session 2026-10-05

- Q: What happens when deleting an article that is on one or more lists? → A: The
  confirmation names the lists holding it; confirming removes the article from the catalog
  and from all those lists; an "Annuler" action is then offered for a few seconds and
  restores everything as it was.
- Q: Is changing an article's category in scope? → A: Yes, it is edited in the same place as
  the name.

### Session 2026-10-06

- Q: Does the 5-second undo window change when a screen reader is on? → A: Yes, as for item
  removal in [001](../001-shopping-lists/spec.md) FR-010: while a screen reader is on, the
  offer stays until the user dismisses it or makes another change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rename an article (Priority: P1)

I made a typo when creating an article, or I want a more precise name ("Lait" becomes
"Lait demi-écrémé"). I rename the article once, from the catalog, and the new name shows
everywhere the article is used.

**Why this priority**: typos happen when creating articles quickly in a store; without
renaming, the only fix is to live with the wrong name.

**Independent Test**: create an article, put it on two lists with different quantities and
tick it on one, rename it, and check both lists show the new name with their quantities and
ticked states unchanged.

**Acceptance Scenarios**:

1. **Given** the article "Lait" exists, **When** I rename it "Lait demi-écrémé", **Then** the
   catalog shows "Lait demi-écrémé" and no longer "Lait".
2. **Given** "Lait" is on "Ma liste" (2 L, ticked) and on "Barbecue" (no quantity,
   unticked), **When** I rename it "Lait demi-écrémé", **Then** both lists show the new name,
   and each keeps its quantity and ticked state.
3. **Given** I renamed "Lait" to "Lait demi-écrémé", **When** I search "demi", **Then** the
   article is found; searching "Lait" also finds it.
4. **Given** an article "Beurre" exists, **When** I try to rename "Lait" to " beurre ",
   **Then** the rename is refused and a French message says an article with that name
   already exists.
5. **Given** I rename "Lait" to "lait" (only the case changes), **When** I confirm, **Then**
   the rename is accepted and the article shows "lait".
6. **Given** I try to rename an article with an empty or blank name, or a name longer than 60
   characters, **When** I confirm, **Then** the rename is refused with a French message and
   the old name is kept.
7. **Given** I start renaming and cancel, **When** I return to the catalog, **Then** the name
   is unchanged.
8. **Given** a list is sorted alphabetically within a category, **When** a rename changes an
   item's alphabetical position, **Then** the item moves to its new position.

---

### User Story 2 - Delete an article (Priority: P1)

I no longer buy an article, or I created a duplicate under a slightly different name. I
delete it from the catalog so it stops cluttering my searches and categories. If it is on
some of my lists, the confirmation tells me which ones, and deleting removes it from them
too. Right after deleting, I can still undo for a few seconds.

**Why this priority**: without deletion, mistakes and unused articles pile up in the catalog
and slow down every search.

**Independent Test**: create an article that is on no list and delete it; create another one
that is on two lists and delete it; check the catalog and the lists; delete a third one and
undo, and check it is back everywhere as before.

**Acceptance Scenarios**:

1. **Given** the article "Houmous" is on no list, **When** I delete it and confirm, **Then**
   it no longer appears in the catalog, its category or search results.
2. **Given** I choose to delete "Houmous", **When** I cancel the confirmation, **Then**
   nothing changes.
3. **Given** "Lait" is on "Ma liste" and "Barbecue", **When** I choose to delete it, **Then**
   the confirmation says it is on "Ma liste" and "Barbecue" and will be removed from them.
4. **Given** that confirmation, **When** I confirm, **Then** "Lait" is gone from the catalog,
   from "Ma liste" and from "Barbecue", and the counts of items left to buy are updated.
5. **Given** I just deleted "Lait", which was on "Ma liste" (2 L, ticked) and "Barbecue" (no
   quantity, unticked), **When** I tap "Annuler" while it is offered, **Then** "Lait" is back
   in the catalog with its name and category, and back on both lists with the same quantity
   and ticked state.
6. **Given** I just deleted an article and no screen reader is on, **When** 5 seconds pass or
   I make another change, **Then** "Annuler" is no longer offered and the deletion is final.
   With a screen reader on, the offer stays until I dismiss it or make another change.
7. **Given** I deleted "Houmous" and the undo is no longer offered, **When** I create a new
   article named "Houmous", **Then** it is created normally, with no trace of the deleted one.
8. **Given** I deleted the last article of a category, **When** I browse that category,
   **Then** the empty state of the category is shown and the category itself still exists.

---

### User Story 3 - Change an article's category (Priority: P2)

I put an article in the wrong category, or I want it elsewhere to match how my store is laid
out. I change its category where I edit its name, and it moves to the new category in the
catalog and on every list.

**Why this priority**: a wrong category puts an item in the wrong aisle on the list, but the
item can still be found and ticked.

**Independent Test**: put an article on a list, change its category, and check it appears
under the new category heading on the list and in the catalog.

**Acceptance Scenarios**:

1. **Given** "Houmous" is in "Épicerie salée" and on "Ma liste", **When** I move it to
   "Crèmerie", **Then** the catalog and the list show it under "Crèmerie", with its quantity
   and ticked state unchanged.
2. **Given** "Houmous" was the only item of "Épicerie salée" on "Ma liste", **When** I move
   it to "Crèmerie", **Then** the "Épicerie salée" heading is no longer shown on that list.
3. **Given** I edit "Houmous", **When** I change both its name to "Houmous nature" and its
   category to "Crèmerie" and confirm, **Then** both changes are applied together; if the new
   name is refused, neither change is applied.
4. **Given** I create a category "Traiteur" (001-shopping-lists), **When** I edit "Houmous",
   **Then** "Traiteur" is offered among the categories.

---

### Edge Cases

- Rename or delete while the device has no network: the change is saved and shown
  immediately, like every other change (offline first).
- The application is closed or killed right after a rename or a deletion: the change is kept
  on reopening, and never half applied (for example, an article gone from the catalog but
  still on a list).
- A rename or deletion fails to save on the device: the article stays as it was everywhere, a
  French error message is shown, and the error is reported.
- The application is closed or killed while "Annuler" is offered: the deletion is final.
- Undoing a deletion fails to save on the device: the article stays deleted, a French error
  message is shown, and the error is reported.
- An article is renamed while one of its lists is on screen: the list shows the new name on
  its next display, without restarting the application.

## Requirements *(mandatory)*

### Functional Requirements

**Renaming**

- **FR-001**: Users MUST be able to rename an article from the catalog (browsing by category
  or search results).
- **FR-002**: A new name MUST follow the naming rules of 001-shopping-lists: non-blank,
  trimmed, at most 60 characters, unique in the catalog compared case-insensitively. Changing
  only the case or the surrounding spaces of the article's own name MUST be accepted.
- **FR-003**: A rename MUST apply everywhere the article appears (catalog, search, every
  list), keeping each list item's quantity and ticked state.

**Deleting**

- **FR-004**: Users MUST be able to delete an article from the catalog after an explicit
  confirmation.
- **FR-005**: Deleting an article MUST NOT delete its category or any list.
- **FR-006**: When the article is on one or more lists, the confirmation MUST name those
  lists, and confirming MUST remove the article from all of them.
- **FR-006a**: Right after a deletion, users MUST be offered to undo it for 5 seconds or until
  their next change, whichever comes first. While a screen reader is on, the offer MUST stay
  until the user dismisses it or makes their next change, as for item removal in 001 (FR-010). Undoing MUST restore the article (name and
  category) and each list item it had (list, quantity, ticked state).
- **FR-007**: Once the deletion is final, the article's name MUST be available again for a
  new article.

**Changing category**

- **FR-008**: Users MUST be able to change an article's category, in the same place where they
  rename it, choosing among all existing categories.
- **FR-008a**: A category change MUST apply everywhere the article appears, keeping each list
  item's quantity and ticked state. A name and category edited together MUST be applied
  together or not at all.

**General**

- **FR-009**: Each rename, category change, deletion or undo MUST be applied completely or not at
  all, and kept across application restarts.
- **FR-010**: All of these actions MUST work without a network connection.
- **FR-011**: Failures MUST be shown in plain French and reported to error tracking without
  any article name or list content.
- **FR-012**: All user-facing text MUST be in French.

### Key Entities

- **Article**: unchanged from 001-shopping-lists; its name and category can now change, and it
  can be removed from the catalog.
- **Deleted article (pending undo)**: what a deletion removed (the article and its list
  items), kept only while "Annuler" is offered so it can be restored as it was.
- **List item**: refers to an article; it shows the article's current name and category, and
  keeps its own quantity and ticked state through any change to the article.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Renaming an article takes under 10 seconds from the catalog.
- **SC-002**: Deleting an article takes at most 3 taps from the catalog, confirmation
  included.
- **SC-003**: After a rename, 100% of the lists holding the article show the new name.
- **SC-004**: 100% of renames and deletions succeed with the device in airplane mode.
- **SC-005**: No rename or deletion is ever left half applied after the application is
  killed during the change.
- **SC-006**: Undoing a deletion restores 100% of the removed list items with their quantity
  and ticked state.
- **SC-007**: Changing an article's category takes under 10 seconds from the catalog.

## Assumptions

- Articles are managed from the catalog (browsing by category and search results). Reaching
  these actions directly from a list item is a convenience the plan may add, not a
  requirement.
- Undo exists only right after a deletion; renames and category changes have no undo, since
  they can simply be edited back.
- Merging two duplicate articles into one is out of scope; the user deletes the unwanted one.
- Renaming or deleting categories and lists stays out of scope, as in 001-shopping-lists.
