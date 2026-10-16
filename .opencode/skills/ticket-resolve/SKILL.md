---
name: Ticket Resolve
description: Orchestre la résolution d'un ticket par un agent, de l'implémentation à la PR
---

# Ticket Resolve

Orchestre la résolution complète d'un ticket GitHub par un agent OpenCode.

## Prérequis

- Un ticket GitHub ouvert avec label `in-progress`
- Une branche `agent/issue-<number>-<slug>` créée depuis `origin/main`
- Les skills Spec Kit disponibles (speckit-specify, speckit-plan, speckit-tasks, speckit-implement)

## Workflow

### Phase 1 — Comprendre le ticket

1. **Lire le ticket** :

   ```bash
   gh issue view <number> --json title,body,labels
   ```

2. **Charger le contexte** :
   - Lire `AGENTS.md` (règles du workspace)
   - Lire `.specify/memory/constitution.md` (principes du projet)
   - Lire les ADR pertinents dans `docs/adr/`
   - Lire la spec de référence si mentionnée

3. **Vérifier les guardrails** :
   - Ne pas éditer hors du scope défini
   - TDD strict (Red-Green-Refactor)
   - Architecture hexagonale respectée

### Phase 2 — Planifier (si nécessaire)

Si le ticket est complexe (L ou XL) ou nécessite une nouvelle fonctionnalité :

1. **Créer/mettre à jour la spec** avec `speckit-specify`
2. **Générer le plan** avec `speckit-plan`
3. **Générer les tâches** avec `speckit-tasks`

Si le ticket est simple (S ou M), passer directement à l'implémentation.

### Phase 3 — Implémenter

1. **Exécuter les tâches** avec `speckit-implement` (ou manuellement pour les tickets simples)
2. **Respecter les guardrails** :
   - Tests avant implémentation (TDD)
   - Pas de dépendances vers l'extérieur dans `domain/`
   - Interface française uniquement
   - États d'écran explicites (Loading/Empty/Error/Success/Synchronization)

### Phase 4 — Vérifier

1. **Lancer les checks** :

   ```bash
   yarn typecheck
   yarn lint
   yarn test
   yarn test:architecture
   ```

2. **Corriger** si nécessaire (l'agent doit itérer jusqu'à ce que tout soit vert)

### Phase 5 — Livrer

1. **Committer** avec un message Conventional Commits :

   ```bash
   git add <fichiers>
   git commit -m "feat/fix: <description>"
   ```

2. **Pousser** :

   ```bash
   git push origin agent/issue-<number>-<slug>
   ```

3. **Créer la PR** :

   ```bash
   gh pr create \
     --title "<description>" \
     --body "<body avec référence au ticket>" \
     --base main
   ```

4. **Mettre à jour le ticket** :
   ```bash
   gh issue comment <number> --body "PR créée : #<pr-number>"
   gh issue edit <number> --remove-label "in-progress" --add-label "done"
   ```

## Sorties

- Code implémenté et testé
- PR créée et liée au ticket
- Ticket marqué `done`

## Gestion des erreurs

- **Si les checks échouent** : l'agent doit corriger et itérer, pas abandonner
- **Si le ticket est bloqué** : commenter sur le ticket, retirer le label `in-progress`, ajouter `blocked`
- **Si le scope est flou** : demander des clarifications dans le ticket avant de continuer

## Exemples

```
/ticket-resolve --number 42
/ticket-resolve  # prend le ticket in-progress courant
```
