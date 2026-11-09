# UI contract: Listes tab

Text is French (Principle X). Paths under `apps/mobile/src/adapters/ui/`.

## Row (`components/ListSummaryRow.tsx`)

- Card: icon circle, name, count; current row outlined with the "en cours" chip; then the ⋮ `RowMenu` (48 dp, label "Actions pour <name>"). No chevron.
- The tap area of the row (label "<name>, <count>[, liste en cours]") excludes the ⋮.
- Menu entries, in this order: "Modifier" (label "Modifier <name>"), "Supprimer" (label "Supprimer <name>").

## Edit dialog (`screens/EditListDialog.tsx`, on `CreateNamedDialog`)

| Part | Text |
| --- | --- |
| Title | Modifier la liste |
| Field | "Nom", pre-filled with the current name |
| Buttons | Annuler / Enregistrer |
| Errors | `NameField` texts for empty and too long; "Une liste porte déjà ce nom." for a duplicate; the dialog stays open |
| Saving | buttons and field disabled, not dismissable |
| Failed save | snackbar "writeFailed"/"storageFull" (existing), dialog stays open as typed |
| List vanished (store `ListNotFound`) or deleted by a pull | dialog closes, no message |

Creation keeps "Nouvelle liste" / "Créer".

## Delete dialog (`screens/DeleteListDialog.tsx`, on `AppDialog`)

| Part | Text |
| --- | --- |
| Icon | `delete`, error tone, centered layout |
| Title | Supprimer « Barbecue » ? |
| Message | La liste et ses articles seront supprimés. Les articles restent dans le catalogue. |
| Buttons | Annuler / Supprimer (dangerFilled) |
| After confirm | closes; list gone; no undo snackbar; failed save shows the existing snackbar and the dialog closes |
| Double tap | deletes once |

## Screen states (Principle IX)

Loading, empty (`lists` is never empty after startup: the default list exists), error ("Impossible de charger vos listes." + Réessayer) and success unchanged; sync status bar unchanged. Focus: after a dialog closes, screen reader focus returns to the row's ⋮ button, or to the FAB after a deletion.

## Stories (`required-stories.ts`)

`Components/ListSummaryRow/MenuOpen`, `Dialogs/EditListDialog/Default`, `Dialogs/EditListDialog/NameError`, `Dialogs/DeleteListDialog/Default`, `Dialogs/DeleteListDialog/DefaultDark`, `Screens/Lists/MenuOpen`.
