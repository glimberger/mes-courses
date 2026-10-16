---
name: Ticket Claim
description: Permet à un agent de piocher dans les tickets ouverts et de les prendre en charge
---

# Ticket Claim

Permet à un agent OpenCode de découvrir et de prendre en charge un ticket GitHub ouvert.

## Entrées

- **Filtre** (optionnel) : label, complexité, ou numéro de ticket spécifique
- **Stratégie** (optionnel) : `priority` (plus prioritaire), `quick-win` (plus simple), `fifo` (plus ancien)

## Workflow

1. **Lister les tickets ouverts** :

   ```bash
   gh issue list --label "agent-ready" --state open --json number,title,labels,createdAt
   ```

2. **Choisir un ticket** selon la stratégie :
   - `priority` : trier par labels (d'abord `fix`, puis `improvement`)
   - `quick-win` : trier par complexité (d'abord S, puis M)
   - `fifo` : trier par date de création (plus ancien d'abord)
   - Par défaut : `fifo`

3. **Vérifier que le ticket est prêt** :
   - Le ticket a des critères d'acceptation clairs
   - Le ticket n'est pas déjà pris (pas de label `in-progress`)
   - Le ticket n'est pas bloqué (pas de label `blocked`)

4. **Prendre le ticket** :

   ```bash
   # Ajouter le label in-progress
   gh issue edit <number> --add-label "in-progress"

   # Commenter la prise en charge
   gh issue comment <number> --body "🤖 **OpenCode** (<model>) prend ce ticket en charge."
   ```

5. **Créer la branche de travail** :

   ```bash
   git fetch origin
   git switch -c agent/issue-<number>-<slug> origin/main
   ```

   Le slug est dérivé du titre du ticket (mots clés, kebab-case, max 5 mots).

6. **Mettre à jour le ticket** avec la branche :
   ```bash
   gh issue comment <number> --body "Branche de travail : \`agent/issue-<number>-<slug>\`"
   ```

## Sorties

- Ticket GitHub marqué `in-progress`
- Branche `agent/issue-<number>-<slug>` créée depuis `origin/main`
- Contexte du ticket chargé pour l'agent

## Exemples

```
/ticket-claim
/ticket-claim --strategy quick-win
/ticket-claim --number 42
```
