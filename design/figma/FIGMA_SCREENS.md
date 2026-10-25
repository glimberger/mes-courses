# Figma — inventaire des écrans et composants

Référence pour recréer l'UI de **Mes Courses** dans Figma avec le Material 3 Design Kit
et le thème déjà importé via Material Theme Builder.

- Thème : `design/material-theme.json` (6 schemes : light / light-medium-contrast /
  light-high-contrast / dark / dark-medium-contrast / dark-high-contrast), rôle custom
  `brandSoft` (`#FFF1BE`).
- Couleur d'action de marque : `#FFDE3F` (primaryContainer light).
- Police : **Nunito** (400/600/700/800/900), voir `apps/mobile/src/adapters/ui/theme/typography.ts`.
- Maquettes HTML de référence : `design/mockups/` (écrans 1 à 13) + captures
  `design/mockups/shots/` (393×852 @2x).
- Tokens d'import : `design/figma/figma-tokens.json` (typo, spacing, rayons, ombres — les couleurs viennent déjà du plugin Material Theme Builder).

## Navigation (routes)

`apps/mobile/src/adapters/ui/routes.ts` — 7 routes :

| Route | Écran | Mockup |
| --- | --- | --- |
| `CurrentList` | Ma liste (articles à acheter, catégories, FAB) | `1-liste.html` / `6-liste-dark.html` |
| `Lists` | Mes listes (cartes + puce « en cours ») | `2-listes.html` |
| `AddArticles` | Ajouter des articles (puces vertes, recherche) | `3-ajouter.html` |
| `CreateArticle` | Créer un article | (pas de mockup dédié) |
| `EditArticle` | Éditer un article | (pas de mockup dédié) |
| `Settings` | Réglages (sections en cartes groupées) | `5-reglages.html` |
| `SignIn` | Connexion (logo en vignette, bouton de marque) | `4-connexion.html` |
| `ChoosePassword` | Choisir un mot de passe | (pas de mockup dédié) |
| `Accounts` | Comptes (partage familial) | (pas de mockup dédié) |

## Dialogues

| Composant | Rôle | Mockup |
| --- | --- | --- |
| `QuantityDialog` | Saisie de quantité | `7-dialog-quantite.html` |
| `FinishShoppingDialog` | Terminer les courses (confirmation de marque) | `8-dialog-terminer.html` |
| `DeleteArticleDialog` | Supprimer un article (destructif) | `9-dialog-supprimer.html` |
| `CreateListDialog` | Nouvelle liste | `10-dialog-nouvelle-liste.html` |
| `CreateCategoryDialog` | Nouvelle catégorie | — |
| `CreateNamedDialog` | Dialogue générique de création nommée | — |
| `ChangePasswordDialog` | Changer le mot de passe | — |
| `ForgotPasswordDialog` | Mot de passe oublié | — |
| `InviteAccountDialog` | Inviter un compte | — |
| `DeleteAccountDialog` / `DeleteMyAccountDialog` | Supprimer un compte | — |
| `DeviceDialog` | Appareil | — |
| `RenameDeviceDialog` | Renommer un appareil | — |
| `RevokeDeviceDialog` | Révoquer un appareil | — |
| `SignOutDialog` | Déconnexion | — |
| `SignedOutNoticeDialog` | Avis de déconnexion | — |
| `SuspendAccountDialog` | Suspendre un compte | — |

## Écrans système / états

| Composant | Rôle | Mockup |
| --- | --- | --- |
| `StartupSplash` | Splash (logo en vignette, indicateur jaune) | `11-splash.html` |
| `StartupError` | Erreur au démarrage | — |
| `CrashError` | Erreur fatale | — |
| `UpdateRequired` | Mise à jour requise | — |
| `FullScreen` | Conteneur plein écran | — |

Snackbar : `BrandSnackbar` / `UndoSnackbar` / `NoticeSnackbar` → `12-snackbar.html` / `13-snackbar-dark.html`.

## Composants réutilisables

`apps/mobile/src/adapters/ui/components/` :

- **Surfaces** : `Card`, `SettingsCard`, `EmptyCategoryCard`, `EmptyState`, `ErrorState`, `StateLayout`, `ScreenStateView`, `StateMessage`, `LoadingState`.
- **Typographie / champs** : `NameField`, `PasswordField`, `SearchField`, `QuantityFields`.
- **Lignes** : `ArticleRow`, `ListItemRow`, `ListSummaryRow`, `CategoryHeader`, `DeviceRow`, `SettingsRow`.
- **Actions** : `Button`, `ScreenFab`, `AppbarIconAction`, `BackAction`, `Chip`, `CategoryPicker`, `BrandCheckbox`, `RadioItem`.
- **Feedback** : `BrandSnackbar`, `UndoSnackbar`, `NoticeSnackbar`, `SyncStatusBar`, `SyncAnnouncer`, `IconCircle`.
- **Marque** : `BrandImage`, `SplashMark`, `AppDialog`, `CreateNamedDialog`, `VisuallyHidden`, `app-error-boundary`.

## Tokens (rappel rapide)

| Catégorie | Source | Valeurs clés |
| --- | --- | --- |
| Couleurs | `material-theme.json` | 6 schemes, rôles M3 complets + `brandSoft` |
| Typo | `typography.ts` | Nunito, 15 rôles + 5 overrides |
| Spacing | `spacing.ts` | xs 4 · sm 8 · md 16 · lg 24 · xl 32 (dp) |
| Rayons | `shape.ts` | xs 4 · sm 8 · md 12 · lg 16 · xl 28 · pill 9999 · checkbox 7 · field 14 · fab 18 · bar 2 |
| Ombres | `elevation.ts` | card · fab · dialog · snackbar · brandTile |
| Élévation (surface) | `theme.ts` | level0..5 → surfaceContainer* |

Import complémentaire : `design/figma/figma-tokens.json` (format DTCG, compatible Tokens Studio) — à importer en plus du thème Material Theme Builder pour les tokens que le plugin ne gère pas (spacing, rayons custom, ombres, overrides de typo).

## Icônes

Material Symbols Rounded, subset généré par `design/icons/build-symbols.sh` à partir de
`apps/mobile/src/adapters/ui/icons/symbols.txt`. Liste des glyphes :
`apps/mobile/src/adapters/ui/icons/symbols-glyphs.json`.

## Conseils pour Figma

1. Importer `figma-tokens.json` via **Tokens Studio** (ou équivalent) pour avoir toutes les
   variables (couleurs par scheme, typo, spacing, rayons, ombres).
2. Créer une page par scheme (light / dark) et utiliser les variables pour les fills.
3. Reproduire les 13 mockups à partir des captures `shots/` (393×852 @2x) comme référence
   pixel-perfect, en s'appuyant sur les composants Material 3 du Design Kit.
4. Nommer les composants Figma comme les composants React (`Card`, `ScreenFab`, …) pour
   garder l'alignement avec le code.
5. Les dialogs sont des overlays : utiliser les frames « dialog » du kit (28 dp de rayon).
