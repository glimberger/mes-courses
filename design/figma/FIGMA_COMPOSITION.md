# Figma — composition écran par écran (composants Material 3)

Guide pour recomposer chaque mockup avec les **composants du Material 3 Design Kit**
au lieu de les redessiner. Chaque mockup = une frame Figma (393×852) composée des
composants listés ci-dessous, avec les tokens de `design/figma/figma-tokens.json` et les couleurs
du plugin Material Theme Builder.

Légende des composants du kit : **Top app bar**, **Card**, **List item**, **Button**
(filled/outlined/text), **FAB**, **Chip** (filter/assist), **Text field** (filled/outlined),
**Dialog**, **Snackbar**, **Checkbox**, **Icon button**, **Divider**, **Progress indicator**.

## Points d'attention — composants à composer à la main

Le kit Material 3 ne couvre pas tout ce que le mockup utilise. Les éléments suivants
doivent être composés à la main (frames auto-layout + composants de base) plutôt que
glissés tels quels depuis le kit :

| Élément mockup | Pourquoi ça ne marche pas tel quel | Composition à la main |
| --- | --- | --- |
| **Top app bar avec Chip sous-titre** (écran 1) | Le composant Top app bar du kit n'accepte qu'un titre texte + actions, pas un Chip. | Frame auto-layout : ligne titre + icon buttons, puis Chip assist en dessous. |
| **Section header** (barre jaune + titre) | Pas de composant « section header » dans le kit. | Frame horizontale : rectangle 4×16 (shape/bar, radius 2) jaune + texte labelMedium. |
| **Icon circle** (icône dans un cercle coloré, dialogs 8/9) | Le kit n'a pas de composant « icon container » coloré. | Ellipse 56×56 (surface container) + icône Material Symbols centrée. |
| **Sync status bar** (écran 5) | Pas de composant équivalent dans le kit. | Frame horizontale : icône + texte, fond surfaceContainer, radius shape/lg. |
| **Brand tile** (image splash, écran 4/11) | Pas de composant image avec ombre brand. | Rectangle radius 40 + image + ombre brandTile (effect style). |
| **Row vide de catégorie** (écran 3) | Pas de list item « état vide avec action ». | Card contenant une frame : texte muted + texte lien primary. |
| **Snackbar inverse** (écrans 12/13) | Le composant Snackbar du kit utilise les couleurs par défaut (surface inverse gérée par le thème) ; vérifier que le mode inverse est bien appliqué. | Utiliser le composant Snackbar du kit mais forcer le text style `snackbarMessage` et la couleur d'action `inversePrimary`. |
| **Checkbox de marque** (écran 1) | Le kit a un Checkbox standard (M3) ; le mockup utilise un checkbox custom jaune avec rayon 7. | Soit utiliser le Checkbox du kit avec la couleur primaryContainer, soit composer un rectangle 24×24 radius 7 + icône check. |
| **FAB extended** avec label | Le kit a un FAB extended, mais le label doit utiliser le text style `labelLarge`. | Utiliser le FAB extended du kit, override le text style du label. |

---

## 1 · Ma liste (`1-liste.html` / `6-liste-dark.html`)

- **Status bar** (système) — 54 px, heure + icônes.
- **Top app bar composée à la main** (le composant Top app bar du kit ne supporte pas
  de Chip comme sous-titre) : une frame auto-layout verticale contenant :
  - ligne 1 : titre « Ma liste » (headlineMedium) à gauche + **Icon button** ×3 à droite
    (`shopping_cart_checkout`, `format_list_bulleted`, `settings`, onSurfaceVariant) ;
  - ligne 2 : **Chip** assist « 3 articles restants » (secondary), composé à la main :
    fond secondary-container, texte onSecondaryContainer, radius pill (9999), pas d'icône
    ni d'action. Le kit a un Chip assist, mais ses couleurs par défaut (surface) ne
    correspondent pas au variant secondary du mockup — override le fill et le text color.
    Aligné à gauche, sans actions. 
  Utilise le composant **Top app bar** du kit uniquement si tu retires le Chip ; sinon
  compose la barre à la main avec des **Icon button** et un **Chip** (filter/assist).
- **Section header** (composé à la main) — barre verticale jaune (shape/bar, 4×16) + titre de
  catégorie (labelMedium, onSurfaceVariant). Répéter par catégorie. Voir tableau
  « Points d'attention ».
- **Card** (filled, radius shape/lg 16) contenant un **List item** par article :
  - `ListItemRow` → **Checkbox** du kit (override : couleur primaryContainer, rayon
    shape/checkbox 7 ; si le rayon n'est pas modifiable, composer un rectangle 24×24
    radius 7 + icône check) + nom (titleMedium) + quantité (labelMedium, onSurfaceVariant)
    + **Icon button** edit + **Icon button** close.
  - Variant `NotInCart` / `InCart` (barré + checkbox cochée).
- **FAB** (extended) en bas à droite : icône `add` + label « Ajouter » (primaryContainer).

Dark : même structure, couleurs du scheme dark.

## 2 · Mes listes (`2-listes.html`)

- **Status bar**.
- **Top app bar** (centered) — titre « Mes listes ».
- **Card** ×N, chacune un **List item** (two-line) :
  - icône `format_list_bulleted` (lead) + titre (titleMedium) + sous-titre « X articles »
    (bodySmall) + chevron_right (ou **Chip** brand « en cours » pour la liste active).
  - Liste active : outline 2 dp primaryContainer (brand).
- **FAB** extended : `add` + « Nouvelle liste ».

## 3 · Ajouter des articles (`3-ajouter.html`)

- **Status bar**.
- **Top app bar** (small) — titre « Ajouter des articles » + **Icon button** `add`.
- **Text field** (outlined) — recherche, icône `search` en leading.
- **Section header** par catégorie (composé à la main, voir tableau).
- **Card** + **List item** par article :
  - nom (titleMedium) + soit **Chip** tertiary « Déjà dans la liste » (si déjà ajouté),
    soit **Icon button** rond (surface primaryContainer soft) `add` (si non ajouté),
  - **Icon button** `more_vert`.
- État vide de catégorie : **Card** contenant une frame horizontale (texte muted bodySmall
  à gauche + texte lien « Créer un article » primary labelMedium à droite) — composé
  à la main, le kit n'a pas de list item « état vide avec action ».

## 4 · Connexion (`4-connexion.html`)

- **Status bar**.
- **Image** (brand tile) — splash-screen.png, 215×215, radius 40, ombre brandTile.
  Composé à la main : rectangle 215×215 (radius 40) + image en fill + effect style
  brandTile. Le kit n'a pas de composant « image brand ».
- **Text field** (outlined) ×4 : serveur, email, mot de passe (trailing icon `visibility`),
  nom de l'appareil.
- **Button** filled brand « Se connecter ».
- Texte lien « Mot de passe oublié ? » (primary, labelMedium).

## 5 · Réglages (`5-reglages.html`)

- **Status bar**.
- **Top app bar** (centered) — « Réglages ».
- **Sync status bar** (custom, composé à la main) — frame horizontale : icône `cloud_upload`
  + texte labelMedium, fond surfaceContainer, radius shape/lg. Le kit n'a pas de composant
  équivalent.
- **Section header** par groupe (Compte, Serveur, Appareils, Actions).
- **Card** (filled) contenant :
  - **List item** (account) : icône `account_circle` + email + **Button** outlined
    « Changer de mot de passe ».
  - **List item** (serveur) : icône `dns` + host + sous-titre + **Button** filled brand
    « Synchroniser maintenant ».
  - **List item** (appareil) : icône `smartphone` + nom + « Cet appareil » + chevron.
  - **Button** outlined « Se déconnecter » + **Button** filled error « Supprimer mon compte ».

## 6 · Ma liste — mode sombre

Identique à #1 avec le scheme dark.

## 7 · Quantité (`7-dialog-quantite.html`)

- **Dialog** (basic, radius shape/xl 28, ombre dialog) sur backdrop scrim + écran de fond.
- Titre (titleLarge) = nom de l'article.
- **Text field** (outlined) ×2 côte à côte : « Quantité » + « Unité » (QuantityFields).
- **Button** text « Effacer la quantité » (aligné à gauche, tertiaire).
- **Button** text « Annuler » + **Button** filled brand (pill) « Enregistrer ».

## 8 · Terminer les courses (`8-dialog-terminer.html`)

- **Dialog** (centered, radius 28) :
  - **Icon circle** brand (composé à la main) — ellipse 56×56 fond primaryContainer +
    icône `shopping_cart_checkout` centrée (onPrimaryContainer). Le kit n'a pas de composant
    « icon container » coloré.
  - Titre « Terminer les courses ? » (titleLarge).
  - Texte body (bodyMedium).
  - **Button** text « Annuler » + **Button** filled brand (pill) « Terminer ».

## 9 · Supprimer un article (`9-dialog-supprimer.html`)

- **Dialog** (centered) :
  - **Icon circle** error (composé à la main) — ellipse 56×56 fond errorContainer +
    icône `delete` centrée (onErrorContainer).
  - Titre « Supprimer « Lait » ? ».
  - Texte body.
  - **Button** text « Annuler » + **Button** filled error (pill) « Supprimer ».

## 10 · Nouvelle liste (`10-dialog-nouvelle-liste.html`)

- **Dialog** (basic) :
  - Titre « Nouvelle liste ».
  - **Text field** (outlined) « Nom » avec placeholder.
  - **Button** text « Annuler » + **Button** filled brand (pill) « Créer ».

## 11 · Splash (`11-splash.html`)

- Fond background.
- **Image** brand tile (composé à la main) — splash-screen.png, radius 40, ombre brandTile.
- **Progress indicator** (linear, indeterminate) en jaune (primaryContainer) — composant
  Progress indicator du kit, override la couleur d'indicateur.

## 12 · Snackbar (`12-snackbar.html` / `13-snackbar-dark.html`)

- **Snackbar** (kit, avec overrides) — composant Snackbar du kit, mais :
  - text style du message → `snackbarMessage` (15 · Bold) ;
  - couleur de surface → inverseSurface (vérifier que le thème inverse est appliqué ;
    sinon override manuellement) ;
  - couleur de l'action → inversePrimary ;
  - radius → shape/lg 16 (override si le kit utilise un autre rayon) ;
  - ombre → snackbar (effect style).
- Dark : surface inverse claire, action dorée foncée.

---

## Correspondance des composants React → kit M3

| Composant app | Composant M3 du kit |
| --- | --- |
| `Card` / `SettingsCard` | Card (filled, radius 16) |
| `ListItemRow` | List item (two-line) |
| `Button` (Brand/Outlined/Danger/Text) | Button (filled/outlined/text) |
| `ScreenFab` | FAB extended |
| `Chip` (secondary/tertiary/brand) | Chip (filter) |
| `QuantityFields` / `NameField` / `PasswordField` / `SearchField` | Text field (outlined) |
| `AppDialog` | Dialog (basic/centered) |
| `BrandSnackbar` / `UndoSnackbar` / `NoticeSnackbar` | Snackbar |
| `BrandCheckbox` | Checkbox |
| `IconCircle` | (custom — cercle coloré avec icône) |
| `ScreenHeader` / `AppbarIconAction` | Top app bar / Icon button |
| `SyncStatusBar` | (custom — barre d'état) |
| `SplashMark` | (custom — image + progress) |

## Procédure recommandée dans Figma

1. Crée une frame 393×852 par mockup.
2. Place les composants du kit selon la composition ci-dessus (drag & drop depuis le kit).
3. Applique les tokens (rayons, spacing, ombres) au lieu des valeurs par défaut du kit.
4. Lie les couleurs au thème Material Theme Builder (variables light/dark).
5. Pour les dialogues : crée une frame « Dialog » réutilisable avec les variants
   (brand icon / error icon / champs / actions).
6. Compare avec les captures `shots/` pour valider.

Tu veux que je génère un fichier JSON décrivant la hiérarchie de chaque écran (pour un plugin d'import automatisé), ou que je détaille un écran en particulier ?