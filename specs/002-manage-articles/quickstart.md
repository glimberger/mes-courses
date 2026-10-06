# Quickstart: Validate Manage Articles

How to check this feature, from the automated suite to a hands-on pass on a device. Setup,
prerequisites and the automated commands are those of
[001's quickstart](../001-shopping-lists/quickstart.md). Behavior is in [spec.md](spec.md);
screens and text in [contracts/ui-screens.md](contracts/ui-screens.md); store rules in
[contracts/ui-state.md](contracts/ui-state.md).

## 1. Automated checks

```sh
yarn typecheck && yarn lint && yarn format:check
yarn test                   # includes store tests, the new use cases, SQLite contract tests
yarn test:architecture  # zustand imported only under apps/mobile/src/adapters/ui
```

Expected: everything passes. Every acceptance scenario has a test named after it (search for
"002 US1-", "002 US2-", "002 US3-"). The offline UI scenario (001) is extended with edit, delete
and undo, still with `fetch` throwing.

Screens and journeys (001 quickstart §2 and §3): the stories listed in
[contracts/ui-screens.md](contracts/ui-screens.md#stories-and-end-to-end-journeys) appear in
Storybook and meet the review checklist; `yarn test:e2e:android` (and `yarn test:e2e:ios` on a
Mac) runs `rename-article` and `delete-article` green with 001's journeys.

## 2. Hands-on scenarios on a device

Start from a build with at least "Ma liste" and a second list "Barbecue".

1. **Rename everywhere** (US1-1, US1-2, US1-3, US1-8): create "Lait" (Crèmerie), add it to
   "Ma liste" with "2" "L" and tick it, add it to "Barbecue" unticked. From the catalog, menu →
   "Modifier", rename "Lait demi-écrémé", save. Both lists show the new name with quantity and
   ticked state kept; searching "demi" and "lait" finds it; its place in the category follows the
   new name. Time it: under 10 s (SC-001).
2. **Rename refusals** (US1-4, US1-5, US1-6, US1-7): with "Beurre" existing, try " beurre ",
   an empty name and a 61-character name: French messages, name kept. Rename to "lait demi-écrémé"
   (case only): accepted. Open and go back: nothing changes.
3. **Change category** (US3-1, US3-2, US3-3, US3-4): create "Traiteur"; move "Houmous" from
   "Épicerie salée" to it on a list where it was the only "Épicerie salée" item: the old heading
   disappears. Try a new name that is taken together with a new category: neither applies.
4. **Delete** (US2-1, US2-2, US2-3, US2-4, US2-8, SC-002): delete an article on no list in 3 taps;
   cancel a deletion; delete "Lait" and read the confirmation naming both lists; confirm and check
   the catalog, both lists and the remaining counts.
5. **Undo** (US2-5, US2-6, US2-7): delete "Lait" again, go back to the current list and tap
   "Annuler" there: it is back on both lists, same quantity and ticked state. Delete it again
   and wait 5 s, or tick another item: "Annuler" disappears. With TalkBack or VoiceOver on,
   delete it and wait more than 5 s: "Annuler" is still offered (FR-006a). Create "Lait" again:
   it is new.
6. **Airplane mode** (FR-010, SC-004): repeat 1, 4 and 5 with airplane mode on.
7. **Killed app** (SC-005, edge cases): rename, then kill the app at once and reopen: renamed
   everywhere. Delete, kill while "Annuler" is shown, reopen: deleted everywhere, never half.
8. **Accessibility**: with TalkBack/VoiceOver, reach "Plus d'actions pour « … »", both menu
   actions, the dialog buttons and the snackbar's "Annuler".
