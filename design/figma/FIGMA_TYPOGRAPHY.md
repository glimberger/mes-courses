# Figma — correspondance Nunito (poids & taille) ↔ styles de texte

Référence pour recréer les styles de texte de **Mes Courses** dans Figma avec la police
**Nunito**, alignés sur `apps/mobile/src/adapters/ui/theme/typography.ts` et sur le scale
Material 3 du Design Kit (qui est sur Roboto par défaut).

## 1. Police et poids

| Poids | Fichier React Native | Nom Figma (font family + weight) | Usage |
| --- | --- | --- | --- |
| 400 | `Nunito_400Regular` | Nunito · Regular | (par défaut, rarement utilisé directement) |
| 600 | `Nunito_600SemiBold` | Nunito · SemiBold | body*, emptyCategory |
| 700 | `Nunito_700Bold` | Nunito · Bold | titleMedium, labelMedium/Small, quantity, snackbarMessage, syncStrip |
| 800 | `Nunito_800ExtraBold` | Nunito · ExtraBold | display*, headline*, titleLarge/Small, labelLarge, compactLabel |
| 900 | `Nunito_900Black` | Nunito · Black | (disponible, non utilisé dans le scale) |

> Dans Figma, la police s'appelle **« Nunito »** et les poids sont des variantes de la même
> famille (Regular / SemiBold / Bold / ExtraBold / Black). Ne pas chercher des familles séparées
> comme « Nunito_600SemiBold » : c'est le nom du fichier React Native, pas du style Figma.

## 2. Type scale (Material 3)

Tailles en **sp** (= px à @1x, density 1). Line-height et letter-spacing repris de
`typography.ts`. Créer un text style Figma par ligne, nommé selon la colonne « Style Figma ».

| Style Figma | Famille | Poids | Taille | Line-height | Letter-spacing | Rôle M3 du kit à remplacer |
| --- | --- | --- | --- | --- | --- | --- |
| `displayLarge` | Nunito | ExtraBold (800) | 57 | 64 | -0.25 | Display Large |
| `displayMedium` | Nunito | ExtraBold (800) | 45 | 52 | 0 | Display Medium |
| `displaySmall` | Nunito | ExtraBold (800) | 36 | 44 | 0 | Display Small |
| `headlineLarge` | Nunito | ExtraBold (800) | 32 | 40 | 0 | Headline Large |
| `headlineMedium` | Nunito | ExtraBold (800) | 28 | 35 | -0.2 | Headline Medium |
| `headlineSmall` | Nunito | ExtraBold (800) | 24 | 30 | 0 | Headline Small |
| `titleLarge` | Nunito | ExtraBold (800) | 22 | 28 | -0.2 | Title Large |
| `titleMedium` | Nunito | Bold (700) | 16.5 | 21 | 0 | Title Medium |
| `titleSmall` | Nunito | ExtraBold (800) | 14 | 18 | 0.2 | Title Small |
| `bodyLarge` | Nunito | SemiBold (600) | 16 | 20 | 0 | Body Large |
| `bodyMedium` | Nunito | SemiBold (600) | 15 | 21.75 | 0 | Body Medium |
| `bodySmall` | Nunito | SemiBold (600) | 13 | 16 | 0 | Body Small |
| `labelLarge` | Nunito | ExtraBold (800) | 15.5 | 19 | 0 | Label Large |
| `labelMedium` | Nunito | Bold (700) | 13 | 16 | 0 | Label Medium |
| `labelSmall` | Nunito | Bold (700) | 12.5 | 16 | 0 | Label Small |

## 3. Overrides (tailles hors scale)

Styles additionnels pour les cas spécifiques de l'app. Créer un text style Figma par ligne.

| Style Figma | Famille | Poids | Taille | Line-height | Letter-spacing | Usage dans l'app |
| --- | --- | --- | --- | --- | --- | --- |
| `quantity` | Nunito | Bold (700) | 13.5 | 16 | 0 | quantité dans `ListItemRow` |
| `compactLabel` | Nunito | ExtraBold (800) | 14.5 | 19 | 0 | puces / labels compacts |
| `snackbarMessage` | Nunito | Bold (700) | 15 | 21.75 | 0 | message du snackbar |
| `syncStrip` | Nunito | Bold (700) | 14 | 16 | 0 | barre de statut de sync |
| `emptyCategory` | Nunito | SemiBold (600) | 14 | 16 | 0 | état vide de catégorie |

## 4. Correspondance avec les styles du kit Material 3

Le Design Kit expose des text styles nommés `Display Large`, `Headline Medium`, etc. (Roboto).
Pour convertir un mockup en composants Material, **remplace** le text style du kit par ton
style Nunito équivalent (colonne « Style Figma » ci-dessus). Ne détache pas le composant :
override uniquement le text style appliqué au layer de texte.

Exemples concrets tirés des mockups :

| Mockup | Élément | Style kit (Roboto) | Style à appliquer (Nunito) |
| --- | --- | --- | --- |
| 1-liste | titre « Ma liste » | Headline Medium | `headlineMedium` (28 · ExtraBold) |
| 1-liste | nom d'article « Pommes » | Title Medium | `titleMedium` (16.5 · Bold) |
| 1-liste | quantité « 2 L » | Label Medium | `quantity` (13.5 · Bold) |
| 1-liste | section « Fruits et légumes » | Label Medium | `labelMedium` (13 · Bold) |
| 1-liste | puce « 3 articles restants » | Label Medium | `labelMedium` (13 · Bold) |
| 2-listes | titre de liste « Barbecue » | Title Medium | `titleMedium` |
| 2-listes | sous-titre « 0 article » | Body Small | `bodySmall` |
| 3-ajouter | titre « Ajouter des articles » | Headline Small | `headlineSmall` (24 · ExtraBold) |
| 4-connexion | bouton « Se connecter » | Label Large | `labelLarge` |
| 5-reglages | titre de groupe « Compte » | Label Medium | `labelMedium` |
| 7-dialog | titre « Farine » | Title Large | `titleLarge` |
| 12-snackbar | message « « Lait » retiré… » | Body Medium | `snackbarMessage` (15 · Bold) |

## 5. Comment créer ces styles dans Figma

**Option A — Manuellement (recommandé pour les 20 styles)**  
Pour chaque ligne des tableaux 2 et 3 :
1. Crée un texte avec Nunito + poids + taille + line-height + letter-spacing.
2. Panneau droit → `Text style` → `+` → nomme-le selon la colonne « Style Figma ».
3. Organise-les dans un dossier `Mes Courses / Typography`.

**Option B — Via Tokens Studio (automatique)**  
Si `figma-tokens.json` est importé, Tokens Studio crée les text styles depuis la section
`typography` (fontFamily = Nunito déjà défini). Vérifie ensuite les poids : Tokens Studio
mappe `fontFamily: "Nunito_600SemiBold"` vers la famille + le poids. Si le poids n'est pas
reconnu, corrige manuellement (Nunito · SemiBold).

**Option C — Dupliquer les styles du kit**  
Duplique les text styles du Design Kit (clic droit → Duplicate), renomme-les, puis change
la police en Nunito + poids. Garde les tailles/interlignes du kit (ils correspondent déjà
au scale M3). C'est la voie la plus rapide si tu veux rester proche du kit.

## 6. Rappel : pas de `fontWeight` dans le code

Dans le code React Native, le poids est porté par le **fichier de police** (`Nunito_600SemiBold`),
pas par une propriété `fontWeight`. Dans Figma, c'est l'inverse : une seule famille `Nunito`
avec la propriété **Weight**. Le mapping est direct (voir tableau 1).

## 7. Export Tokens Studio (optionnel)

Si tu veux que Tokens Studio gère aussi les poids comme tokens réutilisables, ajoute dans
`figma-tokens.json` une section :

```json
"fontWeight": {
  "regular":   { "$value": 400, "$type": "fontWeight" },
  "semiBold":  { "$value": 600, "$type": "fontWeight" },
  "bold":      { "$value": 700, "$type": "fontWeight" },
  "extraBold": { "$value": 800, "$type": "fontWeight" },
  "black":     { "$value": 900, "$type": "fontWeight" }
}
```

Puis régénère le fichier avec la commande déjà utilisée. Tu veux que je l'ajoute maintenant ?