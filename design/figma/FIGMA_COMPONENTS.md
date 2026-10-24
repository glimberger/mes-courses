# Figma — planche de composants

Référence pour recréer les composants de **Mes Courses** dans Figma à partir du Material 3
Design Kit. Chaque composant React ci-dessous correspond à un composant Figma à créer (ou à
une variante d'un composant existant du kit). Les variantes listées sont celles des stories
Storybook (`apps/mobile/src/adapters/ui/components/*.stories.tsx`).

Les captures Storybook sont générées par `story-shots.test.tsx` (voir
`apps/mobile/src/adapters/ui/testing/story-shots.tsx`).

## Composants avec stories (variants documentés)

### ArticleRow
- Fichier : `components/ArticleRow.tsx`
- Storybook : `Components/ArticleRow`
- Variants : `Default`, `AlreadyOnList`
- Rôle : ligne d'article dans la liste « Ajouter » (puce verte si déjà sur la liste).

### Button
- Fichier : `components/Button.tsx`
- Storybook : `Components/Button`
- Variants : `Brand`, `Outlined`, `Danger`, `DangerFilled`, `Text`
- Rôle : bouton principal, styles de marque (jaune), contour, destructif.

### CategoryPicker
- Fichier : `components/CategoryPicker.tsx`
- Storybook : `Components/CategoryPicker`
- Variants : `Default`, `NewCategorySelected`
- Rôle : sélecteur de catégorie (avec création inline).

### Chip
- Fichier : `components/Chip.tsx`
- Storybook : `Components/Chip`
- Variants : `Secondary`, `Tertiary`, `Brand`
- Rôle : puce de filtre / catégorie.

### EmptyCategoryCard
- Fichier : `components/EmptyCategoryCard.tsx`
- Storybook : `Components/EmptyCategoryCard`
- Variants : `Default`
- Rôle : carte d'état vide pour une catégorie.

### EmptyState
- Fichier : `components/EmptyState.tsx`
- Storybook : `Components/EmptyState`
- Variants : `WithAction`, `WithoutAction`
- Rôle : état vide générique avec action optionnelle.

### ErrorState
- Fichier : `components/ErrorState.tsx`
- Storybook : `Components/ErrorState`
- Variants : `Default`
- Rôle : état d'erreur.

### ListItemRow
- Fichier : `components/ListItemRow.tsx`
- Storybook : `Components/ListItemRow`
- Variants : `NotInCart`, `InCart`, `WithQuantity`, `LongName`
- Rôle : ligne d'article sur la liste de courses (checkbox, quantité, nom).

### LoadingState
- Fichier : `components/LoadingState.tsx`
- Storybook : `Components/LoadingState`
- Variants : `Default`
- Rôle : indicateur de chargement.

### NameField
- Fichier : `components/NameField.tsx`
- Storybook : `Components/NameField`
- Variants : `Empty`, `WithError`
- Rôle : champ de saisie de nom.

### NoticeSnackbar
- Fichier : `components/NoticeSnackbar.tsx`
- Storybook : `Components/NoticeSnackbar`
- Variants : `WriteFailed`, `StorageFull`, `PasswordChanged`, `ArticleDeletedElsewhere`,
  `ItemRemovedElsewhere`, `Added`, `LongMessage`, `StackedOverUndo`
- Rôle : snackbar d'information (surface inverse).

### PasswordField
- Fichier : `components/PasswordField.tsx`
- Storybook : `Components/PasswordField`
- Variants : `Hidden`, `WithError`
- Rôle : champ mot de passe avec masquage.

### QuantityFields
- Fichier : `components/QuantityFields.tsx`
- Storybook : `Components/QuantityFields`
- Variants : `Empty`, `Filled`, `WithError`
- Rôle : champs de quantité (unité + valeur).

### SyncStatusBar
- Fichier : `components/SyncStatusBar.tsx`
- Storybook : `Components/SyncStatusBar`
- Variants : `Saved`, `Waiting`, `Sending`, `Failed`, `SignedOutRevoked`,
  `SignedOutAccountDeleted`, `Suspended`, `UpdateRequired`
- Rôle : barre d'état de synchronisation.

### UndoSnackbar
- Fichier : `components/UndoSnackbar.tsx`
- Storybook : `Components/UndoSnackbar`
- Variants : `RemovedItem`, `DeletedArticle`, `AboveFab`, `AboveFabDark`
- Rôle : snackbar « Annuler » avec action.

## Composants sans stories (à documenter à la main)

Surfaces : `Card`, `SettingsCard`, `EmptyCategoryCard`, `EmptyState`, `ErrorState`,
`StateLayout`, `ScreenStateView`, `StateMessage`, `LoadingState`.

Typographie / champs : `NameField`, `PasswordField`, `SearchField`, `QuantityFields`.

Lignes : `ArticleRow`, `ListItemRow`, `ListSummaryRow`, `CategoryHeader`, `DeviceRow`,
`SettingsRow`.

Actions : `Button`, `ScreenFab`, `AppbarIconAction`, `BackAction`, `Chip`,
`CategoryPicker`, `BrandCheckbox`, `RadioItem`.

Feedback : `BrandSnackbar`, `UndoSnackbar`, `NoticeSnackbar`, `SyncStatusBar`,
`SyncAnnouncer`, `IconCircle`.

Marque / divers : `BrandImage`, `SplashMark`, `AppDialog`, `CreateNamedDialog`,
`VisuallyHidden`, `app-error-boundary`.

## Écrans (composants de niveau page)

Voir `design/figma/FIGMA_SCREENS.md` pour la liste des routes et dialogues. Chaque écran est un
composant React dans `apps/mobile/src/adapters/ui/screens/` et dispose souvent d'une story
(`*.stories.tsx`) qui fixe les données de démonstration.

## Mapping Material 3 (kit) et points d'attention

| Composant app | Composant M3 du kit | Overrides / composition à la main |
| --- | --- | --- |
| `Card` / `SettingsCard` | Card (filled/outlined) | Override rayon → shape/lg (16) + ombre → card. Le kit utilise souvent 12. |
| `Button` | Button (filled/outlined/text) | Override text style du label → `labelLarge` (Nunito ExtraBold 15.5). Couleur brand = primaryContainer. |
| `Chip` | Chip (filter/assist) | Override couleurs fond/texte selon variant (secondary/tertiary/brand). |
| `AppDialog` | Dialog (basic/centered) | Override rayon → shape/xl (28) + ombre → dialog. L'icon circle (brand/error) se compose à la main (ellipse 56×56). |
| `ScreenFab` | FAB extended | Override text style du label → `labelLarge`. Couleur = primaryContainer. |
| `BrandSnackbar` / `UndoSnackbar` / `NoticeSnackbar` | Snackbar | Override text style → `snackbarMessage`. Forcer surface inverse (inverseSurface) + action → inversePrimary. |
| `SearchField` / `NameField` / `PasswordField` / `QuantityFields` | Text field (outlined) | Override rayon → shape/field (14). |
| `BrandCheckbox` | Checkbox | Override couleur → primaryContainer + rayon shape/checkbox (7) ; si non modifiable, composer à la main (rectangle 24×24 radius 7 + icône check). |
| `RadioItem` | Radio button | Aucun override particulier. |
| `SyncStatusBar` | (custom) | Composer à la main : frame horizontale, fond surfaceContainer, radius shape/lg. |
| `ListItemRow` | List item (two-line) | Override text style du nom → `titleMedium`, de la quantité → `quantity`. |
| `ScreenHeader` / `AppbarIconAction` | Top app bar / Icon button | Si la barre contient un Chip (écran 1), composer la top app bar à la main. |
| `BrandImage` / `SplashMark` | (custom) | Composer à la main : rectangle radius 40 + image + ombre brandTile. |
| `EmptyState` / `ErrorState` / `LoadingState` | (custom) | Composer à la main avec les text styles du scale. |
| `IconCircle` | (custom) | Composer à la main : ellipse 56×56 + icône centrée. |

## Conseils

1. Créer un composant Figma par composant React, avec des variants correspondant aux stories.
2. Utiliser les variables de tokens (`design/figma/figma-tokens.json`) pour les fills, rayons, espacements.
3. Les icônes viennent de Material Symbols Rounded (subset dans
   `apps/mobile/src/adapters/ui/icons/symbols-glyphs.json`).
