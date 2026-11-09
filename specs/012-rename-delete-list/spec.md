# Feature Specification: Rename and Delete a Shopping List

**Feature Branch**: `feat/issue-192-rename-and-delete-a-shopping-list-from-the-lists-screen`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "On the lists screen, replace the right chevron of each row with a three-dots menu offering Edit (rename only, reusing the creation form) and Delete (with confirmation, cascading to the list's articles). Deleting the current list makes the first remaining list current; deleting the last list creates a new empty default list. Rename and delete are synced like the other entities." (issue #192). Builds on [001-shopping-lists](../001-shopping-lists/spec.md), [003-server-sync](../003-server-sync/spec.md) and [011-tab-navigation](../011-tab-navigation/spec.md), which stated that lists could not be renamed or deleted and that rows had no menu (both now lifted).

## Clarifications

### Session 2026-11-09

Questions were answered with the recommended option (no interactive session).

- Q: Is there an "Annuler" (undo) offer after a deletion, as for articles? -> A: No. The confirmation dialog is the safeguard; once confirmed, the deletion is final (the issue asks for confirmation, not undo).
- Q: What are the menu entries called? -> A: "Modifier" and "Supprimer", the same words as the Articles tab menu (011), with accessible labels naming the list.
- Q: What does renaming to a name another list already has do? -> A: The form refuses it with the existing duplicate-name message of 001 (FR-021 rule: case, accents and spacing ignored), and stays open. Renaming a list to its own current name (or only changing its case) is accepted.
- Q: What is the "new empty default list" created when the last list is deleted? -> A: A list named "Ma liste", as on first launch (001 FR-023); if that name is somehow taken it cannot be, since no list exists.
- Q: What happens if the list is deleted on one device while another device renames it or edits its items? -> A: The deletion wins, as for articles (003): the other device's list disappears at its next sync, without an error; its pending edits to that list are dropped.
- Q: What happens on another device whose current list was deleted elsewhere? -> A: The current list is per device (003 FR-015); that device applies the same fallback rule (first remaining list in displayed order, or a new default list if none) at its next sync, silently.
- Q: What is the "displayed order" for the fallback? -> A: The alphabetical order of the Listes tab (001), computed once the deleted list is removed.
- Q: Does Delete cascade? -> A: Yes: the list's items disappear with it; the articles themselves stay in the catalog and on other lists (002 FR-005 is unchanged). "Its articles" in the issue means its items.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rename a list (Priority: P1)

The shopper made a list with a wrong or outdated name and wants to rename it from the Listes tab without recreating it.

**Why this priority**: Smallest useful slice; it also introduces the row menu used by story 2.

**Independent Test**: With a list "Barbecue", open its ⋮ menu, choose "Modifier", change the name to "Barbecue dimanche", save: the Listes tab shows the new name; its items are intact.

**Acceptance Scenarios**:

1. **Given** the Listes tab, **When** it is shown, **Then** each row shows a ⋮ menu button where the right chevron was, with an accessible label naming the list, and no chevron.
2. **Given** a row, **When** the shopper taps the row itself (not the ⋮), **Then** the list becomes current and the Courses tab is shown, exactly as before.
3. **Given** the ⋮ menu of a row is open, **When** it is shown, **Then** it offers exactly "Modifier" and "Supprimer".
4. **Given** "Modifier" is chosen, **When** the form opens, **Then** it is the list creation form, titled for editing, pre-filled with the current name, with the same validation as creation (empty or blank refused, 60 characters maximum, duplicate name refused with the existing message).
5. **Given** a valid new name, **When** the shopper saves, **Then** the form closes, the list shows the new name in its alphabetical place, and its items and current status are unchanged.
6. **Given** the form is open, **When** the shopper cancels or dismisses it, **Then** the list keeps its name.
7. **Given** the device is offline or the server unreachable, **When** the shopper renames a list, **Then** the change is saved and shown at once and synchronized later.

---

### User Story 2 - Delete a list (Priority: P1)

The shopper no longer needs a list and wants to remove it with its items.

**Why this priority**: The second half of the request; without it lists accumulate forever.

**Independent Test**: With lists "Ma liste" and "Barbecue", delete "Barbecue" from its menu and confirm; cancel once first. Check the Listes tab and, on a second device after sync, the same result.

**Acceptance Scenarios**:

1. **Given** a row's menu, **When** the shopper chooses "Supprimer", **Then** a confirmation dialog opens naming the list and offering "Annuler" and "Supprimer", and says its articles are deleted with it.
2. **Given** the confirmation dialog, **When** the shopper cancels or dismisses it, **Then** nothing changes.
3. **Given** the confirmation dialog, **When** the shopper confirms, **Then** the list and all its items disappear, with no undo offer; the articles stay in the catalog and on other lists.
4. **Given** the deleted list is not the current one, **When** it is deleted, **Then** the current list is unchanged.
5. **Given** the deleted list is the current one and other lists exist, **When** it is deleted, **Then** the first remaining list in displayed order becomes current (shown with the "en cours" chip).
6. **Given** the deleted list was the only one, **When** it is deleted, **Then** a new empty list named "Ma liste" is created and becomes current.
7. **Given** the device is offline or the server unreachable, **When** the shopper deletes a list, **Then** it is removed at once and the deletion is synchronized later.

---

### User Story 3 - Rename and delete reach the other devices (Priority: P1)

The shopper uses several devices and expects a rename or deletion made on one to appear on the others.

**Why this priority**: Constitution Principle VII; a local-only change would be reverted or resurrected by the next sync.

**Independent Test**: With devices A and B synced, rename a list and delete another on A; sync B and check both.

**Acceptance Scenarios**:

1. **Given** A and B are synced, **When** A renames a list and syncs, **Then** B shows the new name after its next sync.
2. **Given** A and B are synced, **When** A deletes a list and syncs, **Then** the list and its items are gone from B after its next sync, and are not restored by any later sync.
3. **Given** B's current list was deleted on A, **When** B syncs, **Then** B's current list becomes the first remaining list (or a new default list if none), without a message.
4. **Given** A deletes a list while B, offline, renames it or changes its items, **When** both sync, **Then** the list is deleted on both.
5. **Given** A deleted the last list and created the default "Ma liste", **When** B syncs, **Then** B does not end with two default lists beyond the merge rule of 003 FR-012.

---

### Edge Cases

- Deleting a list whose rows are open on another screen state (for example the Courses tab shows it): the Courses tab shows the new current list.
- Rename to a name equal under the uniqueness rule to another list: refused, form stays open.
- Delete confirmation open while a sync deletes the same list: the dialog closes silently; confirming a vanished list is a no-op without error.
- The storage fails while renaming or deleting: the change is not applied, a French error is shown with a recovery action, and the error is reported (Principle VIII); stored data is not reset.
- Fast double tap on "Supprimer": the list is deleted once.
- Very long names: the 60-character limit applies to rename too.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each row of the Listes tab MUST show a ⋮ menu button instead of the right chevron; tapping the row itself MUST behave as before (make the list current, show the Courses tab).
- **FR-002**: The menu MUST offer exactly "Modifier" and "Supprimer", with accessible labels naming the list and touch targets of 48 dp.
- **FR-003**: "Modifier" MUST open the list creation form pre-filled with the current name; saving MUST rename the list only, with the same validation as creation (001 FR-021: blank refused, 60 characters maximum, uniqueness ignoring case, accents and spacing, own current name allowed).
- **FR-004**: "Supprimer" MUST open a confirmation dialog ("Annuler" / "Supprimer") before any change; cancelling MUST leave the list untouched.
- **FR-005**: Confirming MUST delete the list and all its items. The articles themselves, categories and other lists MUST remain. No undo is offered.
- **FR-006**: When the deleted list is the current one, the first remaining list in displayed order MUST become current.
- **FR-007**: When the deleted list was the last one, a new empty list named "Ma liste" MUST be created and become current, so that exactly one list is always current (001 FR-002).
- **FR-008**: Rename and delete MUST be applied to the local replica at once and synchronized through the existing mechanism, queued while offline and removed from the queue only once acknowledged (Principle VII).
- **FR-009**: A deletion MUST be final across devices: concurrent renames or item changes on a deleted list MUST NOT resurrect it; two renames of the same list MUST be reconciled by the existing rule for list fields (003).
- **FR-010**: A device whose current list was deleted elsewhere MUST apply FR-006/FR-007 locally at its next sync, silently; the current list stays a per-device choice (003 FR-015).
- **FR-011**: All new text MUST be in French (Principle X), and the screens keep their explicit states (Principle IX). Failures MUST be reported without list content (Principle VIII).
- **FR-012**: Each acceptance scenario MUST be covered by an automated test (rename, delete, current-list fallback, last-list recreation, sync of both operations, offline), and an Android end-to-end journey MUST cover rename and delete; iOS is out of scope.

### Key Entities

- **Shopping list**: a named list; gains the ability to be renamed and to be deleted (a deletion is a permanent, synchronized state of the list).
- **List item**: an article on a list; removed with its list.
- **Current list**: the per-device list shown by the Courses tab; always exactly one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A shopper can rename a list in at most 3 taps plus typing, and delete one in 3 taps (menu, Supprimer, confirm).
- **SC-002**: 100% of cancelled deletions leave the list and its items unchanged.
- **SC-003**: After a rename or deletion, every synchronized device shows the same result after its next successful sync, with no resurrected list.
- **SC-004**: After any deletion, exactly one list is current, in 100% of cases, including the deletion of the last list.
- **SC-005**: Rename and delete complete without waiting for the network (visible result immediately offline).

## Assumptions

- Features 001, 002, 003 and 011 are in place; the list creation form and the tombstone/deletion mechanism of 003 are reused and extended to lists (lists currently have no deletion state in the sync model).
- The server and the sync protocol gain list deletion; existing clients that do not know it are handled by the normal update path of the app.
- Deleting a list is not undoable; archived or finished lists do not exist as a separate concept.
- Changing the order of lists, merging lists and renaming from other screens are out of scope.
