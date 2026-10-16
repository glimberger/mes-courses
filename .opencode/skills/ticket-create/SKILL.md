---
name: Ticket Create
description: Crée un ticket GitHub structuré depuis une description en langage naturel
---

# Ticket Create

Crée un ticket GitHub à partir d'une description en langage naturel.

## Entrées

- **Description** : texte décrivant l'amélioration ou la rectification
- **Type** (optionnel) : `improvement` ou `fix` (détecté automatiquement si omis)
- **Complexité** (optionnel) : S, M, L, XL (détectée automatiquement si omis)

## Workflow

1. **Analyser la description** pour extraire :
   - Le contexte (spec de référence, ADR, fichiers concernés)
   - L'objectif (ce qui doit être fait)
   - Les critères d'acceptation (comment vérifier)

2. **Détecter le type** :
   - Si la description contient "bug", "fix", "corriger", "rectifier" → `fix`
   - Sinon → `improvement`

3. **Détecter la complexité** :
   - S : < 30 min, un seul fichier
   - M : ~1h, quelques fichiers
   - L : demi-journée, plusieurs fichiers ou composants
   - XL : jour+, architecture ou refactoring majeur

4. **Créer le ticket** avec `gh issue create` :

   ```bash
   gh issue create \
     --title "[Agent] <titre concis>" \
     --label "agent-ready" \
     --label "<type>" \
     --body "<body structuré>"
   ```

5. **Body du ticket** (format markdown) :
   ```markdown
   ## Contexte

   <contexte>

   ## Objectif

   <objectif>

   ## Critères d'acceptation

   - [ ] <critère 1>
   - [ ] <critère 2>

   ## Complexité

   <S|M|L|XL>

   ---

   🤖 Créé par **OpenCode** (<model>)
   ```

## Sorties

- Ticket GitHub créé avec les labels `agent-ready` et le type
- Numéro du ticket affiché

## Exemples

```
/ticket-create "Ajouter un écran de paramètres pour changer le thème"
/ticket-create "Corriger le bug de synchronisation quand le réseau revient"
```
