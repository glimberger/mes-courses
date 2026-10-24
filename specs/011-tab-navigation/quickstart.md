# Quickstart: validating the tab navigation

1. `pnpm install`, then from the repository root `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:architecture`.
2. Stories: open Storybook; the screens and dialogs listed in [contracts/ui-screens.md](contracts/ui-screens.md) must each have their states.
3. Android Detox (one suite at a time): the journeys of `tests/e2e` for the tabs, the row menu, tap-to-add, the Listes chip and the Articles catalog.
4. Manual walkthrough, offline then online: open on Courses; add Carotte and Pain by tap; tap Pain again; back; set a quantity from the row menu; remove a row and undo; switch to Listes and make another list current; in Articles rename and delete an article and read the affected-lists counts; open Réglages and its sub-screens.
