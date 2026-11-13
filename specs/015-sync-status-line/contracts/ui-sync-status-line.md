# UI contract: SyncStatusLine

Shared component `components/SyncStatusLine.tsx`, props: none (reads the store's `sync` slice and the navigation). Rendered once, by `NavigationTabBar`, above `TabBar`.

| State | Text (also label) | Icon 18 dp | Color | Action (own label) |
|---|---|---|---|---|
| connected + failed | Échec de la synchronisation | `cloud_alert` | error | Réessayer: `retry()` |
| signedOut revoked | Appareil déconnecté | `cloud_off` | error | Se reconnecter: SignIn, `initial: false` |
| signedOut accountDeleted | Compte supprimé | `cloud_off` | error | Se connecter: SignIn, `initial: false` |
| updateRequired | Mise à jour requise pour synchroniser | `update` | error | none |
| suspended | Compte suspendu · listes conservées | `pause_circle` | onSurfaceVariant | none |
| otherwise | not rendered | | | |

- testID `sync-status-line`; the action `sync-status-line-action`.
- Tap on the line: `navigate('SettingsTab', { screen: 'Settings', pop: true })`.
- Layout: 36 dp, full width, `surfaceContainer`; 1 dp top hairline `surfaceContainerHigh`, 1 dp bottom border `outlineVariant`; text 13 sp bold, one line, ellipsized; action `primary`, 48 dp target, right-aligned.
- Not shown: on the Réglages root screen, while the Android keyboard is shown.
- Accessibility: line `role=button`; no live region; `SyncAnnouncer` unchanged.
- Offsets: `Navigation` provides the line's height (36 or 0); `UndoSnackbar` and `NoticeSnackbar` add it to their bottom offset; `ABOVE_SCREEN_FAB` and `ABOVE_UNDO_OFFER` keep their no-line values.
- Stories: `Components/SyncStatusLine/{Failed,SignedOutRevoked,SignedOutAccountDeleted,UpdateRequired,Suspended}` (+ `SuspendedDark`/`FailedDark` for the separator in the dark theme) and `Screens/CurrentList/WithSyncLine`.
