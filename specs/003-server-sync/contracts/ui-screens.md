# Contract: Screens and User-Facing Text

Changes to the screens of [001](../../001-shopping-lists/contracts/ui-screens.md) and
[002](../../002-manage-articles/contracts/ui-screens.md) for this feature. UI tests assert this
text exactly (Principles II and X). Components come from React Native Paper or the shared module
`apps/mobile/src/adapters/ui/components/` (Principle V). Data comes from the store's `sync` slice
([../research.md](../research.md) R14).

## Navigation

```text
CurrentList
 ├─ Lists
 ├─ AddArticles ─ CreateArticle, EditArticle
 └─ Settings              (new: Appbar action "Réglages", icon cog)
     ├─ ConnectServer     (new)
     └─ PairingCodeDialog (new dialog, "Ajouter un appareil")
```

## SyncStatusBar (new shared component, FR-020)

It is rendered under the Appbar of CurrentList, AddArticles, Lists, EditArticle and Settings.
It is hidden when `connection = notConnected`, because a device that was never connected has
nothing to show (US4-1).

| `sync` slice | Icon | Text |
|---|---|---|
| `status = saved` | cloud-check | "Synchronisé" |
| `status = waiting` | cloud-clock | "En attente de synchronisation ({n})" ("1 modification" / "{n} modifications" in the accessibility label) |
| `status = sending` | progress | "Synchronisation…" |
| `status = failed` | cloud-alert | "Échec de la synchronisation" + button "Réessayer" (US3-4) |
| `connection = disconnectedByServer` | cloud-off | "Cet appareil n'est plus connecté au serveur." + button "Se reconnecter" (US4-10) |
| `connection = updateRequired` | update | "Mettez à jour l'application pour synchroniser." |

- It is never shown in error colors for `waiting`: being offline is normal (US3-2).
- Accessibility (US3-6, US3-7, FR-023): it is **not** a live region. Only two transitions are
  announced, through `AccessibilityInfo.announceForAccessibility`: into `failed` ("Échec de la
  synchronisation") and back to `saved` after a failure ("Synchronisé"). The routine
  "Synchronisation…" ↔ "Synchronisé" cycle and the waiting count are not announced; the bar's
  label stays readable when focused. It is ≥ 48 dp high when it has a button.
- `connection = disconnectedByServer` also covers a phone restored from a system backup, which
  has no credential (FR-018b, [../research.md](../research.md) R12a).
- Tapping the bar opens Settings.

## Changes a pull makes to open screens (FR-020a, FR-008, FR-015, FR-023)

| Situation | Behavior |
|---|---|
| A form that edits synced data is open (QuantityDialog, or EditArticle with its name and category) and a pull changes what it edits | The fields keep what the user typed; saving is a new change (merged on the server). If the entity was merged, the save goes to the survivor. |
| The article it edits was deleted on another device | The form closes; snackbar "Cet article a été supprimé sur un autre appareil."; focus returns as when the form closes (001 FR-037) |
| The item it edits was removed from the list on another device | The form closes; snackbar "Cet article a été retiré de la liste sur un autre appareil." |
| "Annuler" is offered for an item or article whose article the pull deleted | The undo snackbar disappears and the offer ends; a tap racing it restores nothing and shows "Cet article a été supprimé sur un autre appareil." |
| The current list was merged into another list | CurrentList shows the surviving list (its name, the items of both), with no snackbar (US2-10) |
| A screen reader is on and the pull removes the row the user last activated | Focus moves to the next row, the previous one if none, or the empty state, as after a local removal; nothing is announced for the rows the pull changed (US3-7) |

The two snackbars are rendered by 001's `NoticeSnackbar` and announced as it appears (001
FR-038). See [../research.md](../research.md) R8a, R10a and R14.

## Settings (new screen)

Appbar title "Réglages".

**Not connected**: the text "Synchronisez vos listes avec votre serveur pour les retrouver sur
vos autres appareils." and the button "Connecter à un serveur", which opens ConnectServer.

**Connected**:

| Section | Content |
|---|---|
| Serveur | Address (`courses.example.fr`), "Dernière synchronisation : {date relative}" (or "Jamais"), button "Synchroniser maintenant" (US3-5) |
| Appareils | One row per device: name, "Dernière synchronisation : …", "Cet appareil" mark. Row menu: "Renommer", "Révoquer" (not offered on this device) |
| Actions | "Ajouter un appareil" (PairingCodeDialog), "Déconnecter cet appareil" |

| Region | States |
|---|---|
| Devices list | loading `LoadingState`; error "Impossible de charger les appareils." + "Réessayer" (offline: "Liste des appareils indisponible hors connexion." with no error color, not reported); success |

| Action | Behavior |
|---|---|
| "Renommer" | Dialog "Renommer l'appareil", `NameField` "Nom", buttons "Annuler" and "Enregistrer"; name errors as in 001. |
| "Révoquer" | Dialog "Révoquer « {name} » ?", "Cet appareil ne pourra plus synchroniser. Ses données restent sur l'appareil.", buttons "Annuler" and "Révoquer" (US4-9). |
| "Déconnecter cet appareil" | Dialog "Déconnecter cet appareil ?", "Vos listes restent sur cet appareil mais ne seront plus synchronisées.", buttons "Annuler" and "Déconnecter" (US4-11). |

## ConnectServer (new screen)

Appbar title "Connecter à un serveur".

- Field "Adresse du serveur" (placeholder "courses.example.fr"; `https://` is added when the
  user omits it; `http://` is refused).
- Field "Code d'appairage" (placeholder "ABCD-EF23"; capitals, dash optional).
- Field "Nom de cet appareil", prefilled with the device model, at most 60 characters.
- Button "Connecter".

| Outcome | Shown |
|---|---|
| Success | Back to Settings, snackbar "Appareil connecté. Synchronisation en cours…" (US4-4) |
| `InvalidUrl` | "Saisissez une adresse comme courses.example.fr." |
| `ServerUnreachable` | "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion." (US4-6) |
| `UntrustedServer` | "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur." (reported once) |
| `InvalidCode` | "Ce code n'est pas valide ou a expiré. Demandez un nouveau code." (US4-5) |
| `TooManyAttempts` | "Trop d'essais. Réessayez dans {n} minutes." (US4-12) |

## PairingCodeDialog (new)

Title "Ajouter un appareil". Body: "Sur le nouvel appareil, ouvrez Réglages › Connecter à un
serveur et saisissez :", then the code in a large monospace font ("ABCD-EF23") and "Valable
jusqu'à {heure}." Button "Fermer". Offline: "Connexion au serveur nécessaire pour ajouter un
appareil." (US4-3)

## Error reports (Principle VIII)

Contexts used: `{ operation: 'sync' | 'connectToServer' | 'createPairingCode' | 'listDevices' |
'renameDevice' | 'revokeDevice', screen?: 'Settings' | 'ConnectServer' }`. They never contain a
URL, a device name, a code or a credential.

## Stories and end-to-end journeys

Additions to [001's validation contract](../../001-shopping-lists/contracts/ui-validation.md)
(001 research R22, R23). Stories build the `sync` slice through the real use cases on the
in-memory `SyncServer` and `CredentialStore` fakes, never by hand.

| Story id | Shows | Scenarios |
|---|---|---|
| `Components/SyncStatusBar/Saved`, `.../Waiting`, `.../Sending`, `.../Failed`, `.../DisconnectedByServer`, `.../UpdateRequired` | each row of the SyncStatusBar table; `Waiting` not in error colors; `DisconnectedByServer` also built from a connection with no credential (FR-018b) | US3-2, US3-4, US4-10 |
| `Components/NoticeSnackbar/ArticleDeletedElsewhere`, `.../ItemRemovedElsewhere` | the two notices a pull can raise | FR-020a, US1-8 |
| `Screens/CurrentList/WithSyncStatus` | the bar under the Appbar of a data screen | FR-020 |
| `Screens/Settings/NotConnected` | the explanation and "Connecter à un serveur" | US4-1 |
| `Screens/Settings/Connected` | server section and device list, "Cet appareil" marked | US3-5 |
| `Screens/Settings/DevicesLoading`, `.../DevicesError`, `.../DevicesOffline` | the device list states | |
| `Screens/ConnectServer/Default` | the three fields | |
| `Screens/ConnectServer/ServerUnreachable`, `.../InvalidCode`, `.../UntrustedServer`, `.../TooManyAttempts` | the outcome messages | US4-6, US4-5, US4-12 |
| `Dialogs/PairingCodeDialog/Code`, `.../Offline` | the code and its expiry; the offline message | US4-3 |
| `Dialogs/RevokeDeviceDialog/Default`, `Dialogs/DisconnectDialog/Default`, `Dialogs/RenameDeviceDialog/Default` | the device dialogs | US4-9, US4-11 |

| File | Journey | Scenarios |
|---|---|---|
| `sync-unreachable.e2e.ts` | On a fresh install, no sync bar is shown; "Réglages" shows the not-connected text. In ConnectServer, enter `127.0.0.1:9` (nothing listens there on the device, and no DNS query leaves it) and any code: "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion." Back on the current list, add and tick an item: it works at once. | US4-1, US4-6, FR-002 |
