# Feature Specification: Server Synchronization

**Feature Branch**: `feat/003-server-sync`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "feature synchro"

## Clarifications

### Session 2026-10-05

- Q: Who shares the data: one person with several devices, or several people of a household?
  → A: One person with several devices (for example a phone and a tablet). Sharing lists with
  other people stays out of scope.
- Q: Where can the server be reached from, and how is access restricted? → A: From anywhere,
  including the store over mobile data: the server is exposed on the Internet. Each device is
  authorized with a single-use pairing code; connections are encrypted; the user can see the
  authorized devices and revoke one (for example a lost phone).
- Q: If the server loses its data (dead SD card, reinstalled Pi), how is it recovered? → A: No
  backup in this feature. A device that finds the server reset says so and asks to be connected
  again; once paired again, it sends its full local copy, and the copies of several devices merge
  by the reconciliation rules. Backing up the Pi stays the maintainer's job.
- Q: How do devices reach the Pi from the Internet and check it is the user's server? → A: Through
  the maintainer's own domain name (or a dynamic DNS subdomain) that follows the home's changing
  IP address, with a publicly trusted certificate renewed automatically; a port of the home
  router is forwarded to the Pi. Devices check the server like any secure website.
- Q: Does the server report its own errors to error tracking, like the app? → A: Yes, to the same
  error tracking tool as the app, with the same privacy rules: no list content, no names, with
  the server version and environment.

### Session 2026-10-06

- Q: When a phone is restored from a system backup (Android backup or iCloud), what happens to
  sync? → A: It works on its restored copy but counts as not connected, because its device
  credential is not restored; it says in French that it must be connected again, and once
  paired again it sends its pending changes and full copy, merged by the usual rules.
- Q: Must the device credential never come back from a backup, even onto the same phone?
  → A: It is never restored onto another device; a phone restored onto its own hardware may
  get it back and then syncs as the same device.
- Q: When a device's current list is merged into a list with the same name, which list does it
  show? → A: Its current list silently becomes the list it was merged into, which now holds the
  items of both.
- Q: While a dialog or form is open on something, what happens when a sync brings a change to it
  or removes it? → A: The form keeps what the user typed and saving applies it as a new change,
  merged by the usual rules; if the item or article was removed or deleted meanwhile, the form
  closes with a French message.
- Q: With a screen reader on, which sync events are announced, and where does focus go when a
  sync changes the rows on screen? → A: Only "Échec de la synchronisation" and the return to
  "Synchronisé" after a failure are announced; the routine cycle, the waiting count and rows
  changed by a sync are not. Focus stays put; if its row is removed, it moves as after a
  removal in 001 (refined: the row last activated, since the focused element cannot be read on
  React Native).
- Q: While "Annuler" is offered for a removal on this device, what happens if a sync deletes that
  article on another device? → A: The undo offer ends when the deletion arrives and the snackbar
  disappears; if "Annuler" was just tapped, nothing is restored and a French message says the
  article was deleted on another device.

**Depends on**: [001-shopping-lists](../001-shopping-lists/spec.md) and
[002-manage-articles](../002-manage-articles/spec.md). This feature closes the deviation both
plans record from constitution v2.0.0, Principle VII: the home server's database becomes the
source of truth, and each device keeps a local copy that works offline. The open questions it
answers are listed in [001 research R19](../001-shopping-lists/research.md#r19-synchronization-deferred-principle-vii)
and [002 research R7](../002-manage-articles/research.md#r7-synchronization-deferred-principle-vii).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My data is kept on my home server (Priority: P1)

Everything I do in the app (lists, items, ticks, quantities, articles, categories) is saved on my
home server as well as on my phone, without me doing anything. When I am in the store with no
connection, I keep using the app exactly as before; my changes are sent when the server can be
reached again. If I lose or replace my phone, I install the app, connect it to my server, and
find all my data again.

**Why this priority**: the server is the source of truth the constitution requires. A copy that
survives the loss of the phone is the first value it brings, and the other stories build on it.

**Independent Test**: on one device, make changes online and offline. Check they all reach the
server once it is reachable. Then uninstall the app, reinstall it, connect it to the server, and
check every list, item, tick and quantity is back.

**Acceptance Scenarios**:

1. **Given** the device can reach the server, **When** I tick "Lait", **Then** the tick is shown at once (as in 001) and is saved on the server within a few seconds, without any action from me.
2. **Given** the device has no network, **When** I add, tick, rename and delete items, **Then** every change works and is shown at once, and no error is shown.
3. **Given** I made changes offline, **When** the server becomes reachable again (network back, server restarted), **Then** every pending change is sent, in the order I made it, and none is lost or applied twice.
4. **Given** the app is killed while changes are waiting to be sent, **When** I reopen it with the server reachable, **Then** the waiting changes are sent.
5. **Given** my data is on the server, **When** I install the app on a new phone and connect it to the server, **Then** all my lists, items, ticks, quantities, articles and categories appear, and no default category or "Ma liste" is created twice.
6. **Given** I used the app before this feature existed, so my data is only on the phone, **When** I connect it to an empty server, **Then** all my existing data is sent to the server.
7. **Given** I delete an article and tap "Annuler" while it is offered (002), **When** the device syncs, **Then** the server never sees the article as deleted.
8. **Given** I removed "Pain" from "Ma liste" and "Annuler" is offered, **When** a sync brings the deletion of the article "Pain" made on another device, **Then** the offer ends and its snackbar disappears; if I tap "Annuler" at that moment, "Pain" is not restored and "Cet article a été supprimé sur un autre appareil." is shown.

---

### User Story 2 - The same data on several devices (Priority: P1)

I use the app on more than one device of my own (for example my phone and my tablet). A change
made on one device appears on the others on their next sync. When two devices changed the same
thing while apart (I edited the list on the tablet at home while the phone was offline), the
app settles the difference by fixed rules, the same on every device, without asking me and
without losing unrelated changes.

**Why this priority**: having one source of truth only pays off when every device sees it;
without this story the server is only a backup.

**Independent Test**: connect two devices to the same server. Make a change on each, online and
then offline on both at once, and check that after both have synced they show exactly the same
data, following the reconciliation rules below.

**Acceptance Scenarios**:

1. **Given** devices A and B are connected and online, **When** I add "Pain" to "Ma liste" on A, **Then** B shows "Pain" on "Ma liste" within a few seconds while the app is open, or as soon as it is next opened.
2. **Given** A and B are offline, **When** A ticks "Lait" and B, later, unticks it, **Then** once both have synced, both show "Lait" unticked: the change made last wins.
3. **Given** A and B are offline, **When** A renames "Lait" to "Lait entier" and B changes the quantity of "Lait" on "Ma liste" to "2 L", **Then** once both have synced, both show "Lait entier, 2 L": changes to different things are both kept.
4. **Given** A and B are offline, **When** both create an article named "Houmous" (or " houmous "), **Then** once both have synced, a single "Houmous" exists, and the list items both devices added for it are kept on their lists. The same holds for categories and lists with the same name.
5. **Given** A and B are offline, **When** A deletes the article "Lait" and B ticks it or renames it, **Then** once both have synced, "Lait" is deleted everywhere: a deletion wins over a concurrent change to what it deletes.
6. **Given** A and B are offline, **When** A removes "Pain" from "Ma liste" and B changes its quantity, **Then** once both have synced, "Pain" is not on "Ma liste".
7. **Given** A finishes shopping on "Ma liste" (every item unticked), **When** B, offline, had ticked "Œufs" after A finished, **Then** once both have synced, "Œufs" is ticked and every other item is unticked.
8. **Given** A and B each create a category while offline, **When** both have synced, **Then** both categories exist, after the existing ones, in the same order on every device.
9. **Given** A has "Ma liste" as current and B chooses "Barbecue" as current, **When** both sync, **Then** each device keeps its own current list.
10. **Given** A and B each created a list "Barbecue" offline, and B has its own "Barbecue" as current, **When** both have synced and B's list is the one merged away, **Then** B shows the surviving "Barbecue" as current, holding the items of both, with no message.

---

### User Story 3 - I can see whether my changes are saved on the server (Priority: P2)

Each screen that shows my data tells me discreetly whether my changes are saved on the server,
waiting to be sent, being sent, or could not be sent. Being offline is shown as a normal status,
never as an error. I can ask for a sync now.

**Why this priority**: syncing works without it, but without a status I cannot know whether the
change made in the store has reached the other devices.

**Independent Test**: watch the status while making a change online (being sent, then saved),
offline (waiting), and with the server refusing changes (could not be sent, with a retry).

**Acceptance Scenarios**:

1. **Given** every change is on the server, **When** I look at any data screen, **Then** the status says everything is saved ("Synchronisé").
2. **Given** I made changes offline, **When** I look at the screen, **Then** the status says changes are waiting ("En attente de synchronisation"), with how many, and no error is shown.
3. **Given** changes are being sent, **When** I look, **Then** the status says so ("Synchronisation…").
4. **Given** the server refuses or fails to save changes several times in a row, **When** I look, **Then** the status says sync failed ("Échec de la synchronisation") with a "Réessayer" action, and the failure is reported to error tracking.
5. **Given** the server is reachable, **When** I choose "Synchroniser maintenant", **Then** a sync starts at once.
6. **Given** a screen reader is on, **When** sync fails, **Then** "Échec de la synchronisation" is announced in French, and the next "Synchronisé" is announced too; the routine change between "Synchronisation…" and "Synchronisé", and the waiting count, are not announced and stay readable in the status.
7. **Given** a screen reader is on and I last activated the row "Pain", **When** a sync removes "Pain" from the list (removed on another device), **Then** focus moves to the next row, or the previous one if none, or the empty state, as after a removal in 001 (001 FR-037), and nothing is announced for the rows a sync changed.

---

### User Story 4 - Connect a device to my server, securely (Priority: P2)

My server can be reached from anywhere, so I can sync in the store over mobile data. Because it
is on the Internet, only my own devices may use it. The first time, I enter the server's
address and a single-use pairing code; after that, the device connects on its own over an
encrypted connection. From any of my devices, I can see the devices allowed to use my server
and revoke one, for example a lost phone.

**Why this priority**: required before any sync, and it keeps my data out of strangers' hands;
but it is a one-time step per device.

**Independent Test**: on a fresh install, connect with a valid pairing code and check the data
arrives; try an expired, reused or wrong code and check the French errors; revoke the device
from another one and check it can no longer sync while it keeps working on its local copy.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** I open the app, **Then** it works at once on a local copy, as in 001, and offers to connect to a server from the settings without blocking me.
2. **Given** no device is connected yet, **When** I ask the server for a first pairing code (from the server itself), **Then** it gives a single-use code valid for 10 minutes.
3. **Given** a device already connected, **When** I choose "Ajouter un appareil" in its settings, **Then** it shows a single-use pairing code valid for 10 minutes.
4. **Given** I enter my server's address (its domain name, for example `courses.example.fr`) and a valid pairing code on a new device, **When** I confirm, **Then** the device is authorized, gets a name (the device model by default, which I can change), connects and runs a first sync (US1-5, US1-6).
5. **Given** the code is wrong, expired or already used, **When** I confirm, **Then** a French message says the code is not valid and asks for a new one, and the device is not authorized.
6. **Given** the address is wrong or the server cannot be reached, **When** I confirm, **Then** a French message says the server could not be reached, and nothing changes.
7. **Given** a device that is not authorized, or whose authorization was revoked, **When** it tries to read or send data, **Then** the server refuses, and no data is read or changed.
8. **Given** a connected device, **When** I open the settings, **Then** I see the server it is connected to, when it last synced, and the list of authorized devices with their names and last sync.
9. **Given** my phone is lost, **When** I revoke it from my tablet and confirm, **Then** the phone can no longer sync, and the tablet keeps syncing.
10. **Given** a device was revoked, **When** it next tries to sync, **Then** it shows in French that it is no longer connected to the server, keeps working on its local copy, and offers to connect again with a new pairing code.
11. **Given** a connected device, **When** I disconnect it and confirm, **Then** its authorization ends, the app keeps working on its local copy and stops syncing, and the data on the server is untouched.
12. **Given** many wrong pairing codes are tried, **When** the limit is reached, **Then** the server refuses further attempts for a while, so a code cannot be guessed.

---

### Edge Cases

- The server is down, restarting or its storage is full: handled like being offline; changes wait, nothing is lost, and only repeated refusals count as a failure (US3-4).
- A device stays offline for weeks: its changes are sent when it reconnects and reconciled by the same rules; no change is dropped for being old.
- The same change is sent twice (connection lost before the server's answer): it is applied once.
- The device clock is wrong: the "most recent change wins" rule must still give the same result on every device and must not let a device with a clock in the future win every conflict forever.
- A rename on one device makes an article's name equal to another article's name created on another device: the two articles are merged, as in US2-4.
- An article is deleted on one device while another device has it on a list it is editing: the deletion wins (US2-5); the list on the other device updates on its next sync without an error.
- The app is updated while changes are waiting: they are kept and sent after the update.
- A second device connects while the first one has changes waiting: those changes reach the second device once the first one syncs.
- The server holds data from a newer version of the app: the older app does not damage it and says in French that it needs an update.
- A device is revoked while it has changes waiting: those changes are not accepted by the server; the device keeps them locally and sends them if it is connected again with a new pairing code.
- The server lost its data and was reinstalled empty: each device behaves as revoked (US4-10) until it is paired again; the first one repopulates the server, and the next ones merge their copies into it (FR-018a). Data that existed only on the lost server, with no device holding it, is lost.
- A phone is restored from a system backup (Android backup or iCloud, 001 Assumptions): it opens
  on the restored local copy, older than the server's data, with the pending changes it held at
  backup time. When restored onto another phone, its device credential is not restored, so it
  is not connected: it says so in French and offers to connect again (FR-018b). When restored
  onto its own hardware (iOS can bring the credential back there), it syncs at once as the
  same device. Once paired again, the restored changes are
  merged by FR-009 to FR-014; changes made since on other devices are more recent, so they win.
- A dialog or form is open (quantity, rename, category) when a sync changes what it edits: the
  form keeps what the user typed, and saving it is a new change, merged by FR-009 to FR-014
  (FR-020a). If what it edits was deleted or removed on another device meanwhile, it closes
  with a French message instead.
- The home's IP address changes: the domain name follows it, and devices keep syncing with no action from the user.
- The server's certificate is expired or invalid (for example a failed renewal): devices refuse to sync and behave as offline; after several failed attempts the status shows "Échec de la synchronisation" and the failure is reported (US3-4), with nothing sent to an unverified server.
- The domain name itself changes: devices cannot reach the server and behave as offline until the user enters the new address in the settings; their authorization is kept.

## Requirements *(mandatory)*

### Functional Requirements

**Source of truth and local copy**

- **FR-001**: The home server MUST hold the reference copy of all user data: lists, items with their ticked state and quantity, articles, categories and their order.
- **FR-002**: Each device MUST keep a full local copy and read and write it first. Every action of 001 and 002 MUST complete and show its result without waiting for the network or the server.
- **FR-003**: When the server cannot be reached, for any reason, the app MUST behave exactly as when offline: no action is blocked, no data is lost, no error is shown.

**Sending and receiving changes**

- **FR-004**: Changes MUST be sent to the server automatically, without a user action, whenever it can be reached: after each change, when the app opens or comes back to the foreground, and when the connection returns.
- **FR-005**: Changes not yet confirmed by the server MUST be kept across restarts, app updates and killed apps, and sent in the order they were made.
- **FR-006**: Each change MUST be applied on the server exactly once, even when it is sent more than once.
- **FR-007**: Changes made on other devices MUST be received when the app opens, when it comes back to the foreground, and periodically while it is open and the server is reachable.
- **FR-008**: A deletion (002) or an item removal (001) that is undone with "Annuler" MUST never reach the server; it is sent only once it is final. When a sync brings the deletion of the article concerned by the undo offer (deleted on another device), the offer MUST end at once and its snackbar disappear; an "Annuler" that arrives after it restores nothing and shows the French message "Cet article a été supprimé sur un autre appareil." (FR-011).

**Reconciliation** (deterministic: every device ends with the same data)

- **FR-009**: Concurrent changes to different things (for example a name and a quantity) MUST both be kept.
- **FR-010**: Concurrent changes to the same thing (an item's tick, an item's quantity, an article's name or category) MUST be settled by keeping the most recently made change, with a fixed tie-break, so the result is the same on every device whatever order the changes arrive in.
- **FR-011**: A deletion of an article or the removal of an item MUST win over any concurrent change to that article or item.
- **FR-012**: Articles, categories or lists whose names are equal under the uniqueness rule of 001 (FR-021) MUST be merged into one. The merged entity keeps the list items of both; if both were on the same list, the item's tick and quantity follow FR-010.
- **FR-013**: "Terminer les courses" MUST untick the items that were ticked when it was done; a tick made after it, on any device, MUST be kept.
- **FR-014**: Category order MUST be the same on every device: categories created concurrently are placed after the existing ones, in a fixed order.
- **FR-015**: The current list MUST stay a per-device choice and is not synchronized. When a
  device's current list is merged into another list (FR-012), that device's current list MUST
  become the surviving list, with no message, so exactly one existing list stays current
  (001 FR-002).

**Connecting a device**

- **FR-016**: Users MUST be able to connect the app to their server from the settings, see which server it is connected to and when it last synced, and disconnect it.
- **FR-017**: A device connected to a server that already holds data MUST take that data, merging its own local data into it by FR-012, and MUST NOT create the default categories or "Ma liste" a second time.
- **FR-018**: A device connected to an empty server MUST send all its local data to it.
- **FR-018a**: When a device finds that the server no longer knows it (the server was reset or reinstalled), it MUST keep its local copy and its pending changes, show in French that it must be connected again, and, once paired again, send its full local copy, merged by FR-009 to FR-014 with what other re-paired devices already sent. The feature provides no server backup.
- **FR-018b**: A device credential MUST never be restored onto another device from a system
  backup; a phone restored onto its own hardware may get its own credential back, and then
  syncs as the same device, its restored changes merged by FR-009 to FR-014. A device whose
  local copy says it was connected but that holds no credential (a phone restored from a
  backup) MUST keep its local copy and pending changes, show in French that it must be
  connected again, and, once paired again with a new pairing code, send its pending changes
  and full local copy, merged by FR-009 to FR-014. The authorization of the device it was
  restored from is left as it is.
- **FR-019**: The server MUST be reachable from the Internet under the maintainer's domain name, which keeps pointing to the home when its IP address changes. Every exchange between a device and the server MUST be encrypted, and devices MUST verify the server through a publicly trusted certificate that is renewed automatically, never through an exception they accept. A device that cannot verify the server MUST NOT send or receive data and behaves as offline.
- **FR-019a**: Only authorized devices MUST be able to read or change data on the server. A device MUST be authorized with a pairing code that is single-use, valid for 10 minutes, and provided either by the server itself (first device) or by an already authorized device.
- **FR-019b**: The server MUST limit failed pairing attempts so that a code cannot be guessed (at most 5 wrong attempts per 10 minutes).
- **FR-019c**: Users MUST be able to see the authorized devices (name, last sync) from any authorized device, rename them, and revoke any of them; a revoked or disconnected device MUST be refused at once and keep its local copy.

**Status, errors, language, accessibility**

- **FR-020**: Every screen showing user data MUST show a synchronization status with four values (saved, waiting with a count, sending, failed), through one shared component, as required by constitution Principle IX. Offline is a normal waiting status.
- **FR-020a**: Changes received from the server MUST NOT overwrite what the user is typing in an
  open dialog or form; saving it records a new change, merged by FR-009 to FR-014, and an
  entity merged meanwhile (FR-012) is saved on the surviving one. When what the form edits was
  deleted or removed on another device meanwhile, the form MUST close and a French message MUST
  say so: "Cet article a été supprimé sur un autre appareil." for a deleted article, "Cet
  article a été retiré de la liste sur un autre appareil." for a removed item.
- **FR-021**: Users MUST be able to start a sync now and to retry after a failure.
- **FR-022**: Repeated sync failures MUST be reported to error tracking without any list content or name (001 FR-030). Being offline or the server being unreachable MUST NOT be reported.
- **FR-022a**: The server MUST report its own unexpected errors (failed writes, crashes, failed certificate renewal) to the same error tracking tool as the app, with its version and environment and without any list content, name or device name. Refused pairing attempts and refused unauthorized requests are expected events, not errors, and are not reported individually.
- **FR-023**: All user-facing text MUST be in French. Screen readers MUST announce the status only when sync fails ("Échec de la synchronisation") and when it is back to "Synchronisé" after a failure; the routine change between sending and saved, the waiting count, and rows added, changed or removed by a sync MUST NOT be announced. A sync MUST NOT move screen reader focus, except when it removes the row the user last activated: focus then moves as after a removal (001 FR-037). A row the user only moved to without activating it is left to the screen reader, which moves focus off a removed element itself.

### Key Entities

- **Home server**: the server on the maintainer's Raspberry Pi that holds the reference copy of the data.
- **Local copy**: the full set of data on a device, read and written first, kept in line with the server.
- **Pending change**: a change made on a device and not yet confirmed by the server. It is kept in order and survives restarts.
- **Sync status**: per device, one of saved, waiting (with a count), sending or failed, plus the time of the last successful sync.
- **Server connection**: per device, the server it uses and whether it is connected.
- **Authorized device**: a device allowed to use the server, with a name the user can change, the date of its last sync, and whether it is revoked.
- **Pairing code**: a single-use code, valid for 10 minutes, that authorizes one new device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With both devices online and the app open, a change on one device appears on the other within 10 seconds.
- **SC-002**: 100% of the changes made offline reach the server after reconnection, with none lost or applied twice, including after the app was killed.
- **SC-003**: After any sequence of concurrent offline changes on two devices, both show identical data once synced (checked over the scenarios of US2).
- **SC-004**: Every action of 001 and 002 still completes in airplane mode and with the server switched off, with the same response times as before this feature (001 SC-001, SC-002).
- **SC-005**: Restoring all data on a new device, once connected, takes under 30 seconds for one user's data (hundreds of articles, a few lists).
- **SC-006**: Connecting a device to the server takes under 1 minute.
- **SC-007**: No default category or list is ever duplicated by connecting a device.
- **SC-008**: 100% of requests from unauthorized or revoked devices are refused, and no data is read or changed by them.
- **SC-009**: A revoked device stops syncing on its very next attempt.

## Assumptions

- One home server, a Raspberry Pi run by the maintainer, holds the data of a single user. Installing and running it is part of the project, including making it reachable from the Internet: a domain name (or dynamic DNS subdomain) owned by the maintainer, a forwarded port on the home router, and an automatically renewed certificate. The home Internet connection allows incoming connections (no carrier-grade NAT). Its hardware, backups (none are provided by this feature, FR-018a) and availability are the maintainer's responsibility; the app never depends on it being up (FR-003).
- One user only: there are no accounts and no people, only authorized devices. Sharing lists with other people may come in a later feature.
- The current list stays per device (FR-015): choosing a list on the tablet does not switch the phone's screen.
- "Most recently made" refers to when the change was made on its device, not when it reached the server. The plan chooses how to order changes across devices so the edge case on wrong clocks holds.
- Undo stays as in 001 and 002: an undo offer lives only on the device where the change was made.
- There is no history of past versions and no way to restore deleted data from the server in this feature.
- Every authorized device sees all the data; nothing is shared selectively.
- Revoking a lost device stops it from syncing; it does not erase the copy already on that device.
- This feature replaces 001 FR-027's "no data is shared or synchronized" and 001's single-device assumption.
