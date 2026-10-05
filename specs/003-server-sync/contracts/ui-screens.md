# Contract: Screens and User-Facing Text

Changes to the screens of [001](../../001-shopping-lists/contracts/ui-screens.md) and
[002](../../002-manage-articles/contracts/ui-screens.md) for this feature. UI tests assert this
text exactly (Principles II and X). Components come from React Native Paper or the shared module
`src/adapters/ui/components/` (Principle V). Data comes from the store's `sync` slice
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
- Accessibility: it is a live region (`accessibilityLiveRegion="polite"`), so each change is
  announced (US3-6, FR-023). It is ≥ 48 dp high when it has a button.
- Tapping the bar opens Settings.

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
