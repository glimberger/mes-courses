# Data Model: Sync Status Line

No stored data and no store change. The line is a pure projection of the existing `SyncSlice` (`apps/mobile/src/adapters/ui/state/store-kit.ts`): `connection`, `signedOutReason`, `status`.

## SyncLine (derived, not stored)

| Field | Type | Notes |
|---|---|---|
| `icon` | Material Symbol name | `cloud_alert`, `cloud_off`, `update`, `pause_circle` |
| `text` | string (French) | also the accessibility label of the line |
| `tone` | `'error' \| 'neutral'` | `neutral` only for `suspended` |
| `action` | `'retry' \| 'reconnect' \| undefined` | with its own label |

## Mapping (`syncLine(slice)`)

| `connection` | `signedOutReason` | `status` | Result |
|---|---|---|---|
| `connected` | any | `failed` | Échec de la synchronisation / `cloud_alert` / error / retry "Réessayer" |
| `connected` | any | `saved`, `waiting`, `sending` | null |
| `signedOut` | `revoked` | any | Appareil déconnecté / `cloud_off` / error / reconnect "Se reconnecter" |
| `signedOut` | `accountDeleted` | any | Compte supprimé / `cloud_off` / error / reconnect "Se connecter" |
| `updateRequired` | any | any | Mise à jour requise pour synchroniser / `update` / error / none |
| `suspended` | any | any | Compte suspendu · listes conservées / `pause_circle` / neutral / none |
| `notConnected` | any | any | null |

## Visibility (UI state, derived)

`lineHeight = syncLine(slice) !== null && !onSettingsRoot && !androidKeyboardShown ? 36 : 0`, provided to the line and the snackbars by `Navigation` (research R3).
