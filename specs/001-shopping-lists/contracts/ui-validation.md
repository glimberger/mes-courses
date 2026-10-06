# Contract: Screen Validation and End-to-End Journeys

What the Storybook catalog ([research.md](../research.md) R22) and the Detox journeys
([research.md](../research.md) R23) must contain. The story test fails when a required story is
missing, and each journey names the spec scenarios it covers. Later features add their rows here
or in their own `contracts/ui-screens.md` ([002](../../002-manage-articles/contracts/ui-screens.md#stories-and-end-to-end-journeys),
[003](../../003-server-sync/contracts/ui-screens.md#stories-and-end-to-end-journeys)).

## Story conventions

- One `*.stories.tsx` file next to each shared component, screen or dialog, in
  `apps/mobile/src/adapters/ui/`.
- Story titles are developer-facing, so they are in English: `Components/<Component>`,
  `Screens/<Screen>`, `Dialogs/<Dialog>`. Story names are the state or variant in PascalCase
  (`Loading`, `Empty`, `Error`, `Success`, `AllInCart`, ...). The story id used below is
  `<title>/<Name>`.
- Everything a story displays is in French, from the fixtures, and matches
  [ui-screens.md](ui-screens.md) (Principle X).
- Screen and dialog stories get their data from `createStoryStore(scenario)`: real use cases on
  in-memory fakes. A story never builds a `ScreenState` by hand (R22).
- Fixtures include names at the 60-character limit, so wrapping can be checked at 200% text size.
- The theme follows the system scheme; the story test renders every story in light and dark.

## Required stories

### Shared components

| Story id | Shows |
|---|---|
| `Components/LoadingState/Default` | Indicator with label "Chargement" |
| `Components/EmptyState/WithAction`, `Components/EmptyState/WithoutAction` | Message, with and without action button |
| `Components/ErrorState/Default` | Message and "Réessayer" |
| `Components/ListItemRow/NotInCart`, `.../InCart`, `.../WithQuantity`, `.../LongName` | The row's visual states (ticked style: check mark and struck-through text) |
| `Components/ArticleRow/Default`, `Components/ArticleRow/AlreadyOnList` | With and without the "Déjà dans la liste" chip |
| `Components/QuantityFields/Empty`, `.../Filled`, `.../WithError` | Fields and a `HelperText` error |
| `Components/NameField/Empty`, `.../WithError` | Field and a `HelperText` error |
| `Components/UndoSnackbar/RemovedItem` | "« Lait » retiré de la liste" with "Annuler" |
| `Components/NoticeSnackbar/WriteFailed` | "La modification n'a pas pu être enregistrée." |

### Screens and dialogs

| Story id | State or variant | Scenarios |
|---|---|---|
| `Screens/CurrentList/Loading` | loading | US1-11 |
| `Screens/CurrentList/Error` | error | US1-12 |
| `Screens/CurrentList/Empty` | empty | US1-10 |
| `Screens/CurrentList/Success` | several categories, ticked and unticked items, quantities | US1-1, US1-6, US1-7 |
| `Screens/CurrentList/AllInCart` | "Tout est dans le caddie", "Terminer les courses" offered | US1-8 |
| `Screens/AddArticles/Loading`, `.../Error` | loading, error | |
| `Screens/AddArticles/NoQuery` | every category, one empty | US2-15 |
| `Screens/AddArticles/SearchMatches` | grouped matches, one "Déjà dans la liste" | US2-10, US2-8 |
| `Screens/AddArticles/SearchNoMatch` | "Aucun article ne correspond à « xyz »" | US2-14 |
| `Screens/CreateArticle/Empty` | blank form | US2-7 |
| `Screens/CreateArticle/NameAlreadyUsed` | "« Lait » existe déjà." and "Ajouter « Lait »" | US2-9 |
| `Screens/Lists/Loading`, `.../Error`, `.../Success` | the three states; current list marked | US3-7, US3-8 |
| `Dialogs/QuantityDialog/Add`, `.../Edit`, `.../AlreadyOnList`, `.../InvalidAmount` | the dialog's modes and an error | US2-2, US2-4, US2-8, US2-12 |
| `Dialogs/FinishShoppingDialog/Default` | | US1-8 |
| `Dialogs/CreateListDialog/Default`, `.../NameAlreadyUsed` | | US3-5 |
| `Dialogs/CreateCategoryDialog/Default`, `.../NameAlreadyUsed` | | US4-3 |

## End-to-end journeys

Each journey is one file in `tests/e2e/journeys/`, starting from a fresh install. It finds
elements by French text and accessibility label only (no `testID`), and runs on the release
build.

| File | Journey | Scenarios |
|---|---|---|
| `first-launch.e2e.ts` | Fresh install opens on "Ma liste" with "Votre liste est vide"; "Ajouter" shows the default categories in order. | US3-1, US4-1, US1-10 |
| `add-and-tick.e2e.ts` | Create "Lait" in Crèmerie with "2" "L" and add it; add an existing article; back on the list, tick "Lait": its row label becomes "Lait, 2 L, dans le caddie" and it moves below unticked items; the remaining count updates. | US2-7, US2-2, US1-2, US1-6, US1-7 |
| `persistence.e2e.ts` | Tick an item, terminate the app process, relaunch: the tick and the items are kept. Then make another list current, terminate, relaunch: it is still current. | US1-4, SC-007, FR-028 |
| `remove-and-undo.e2e.ts` | Remove a ticked item with a quantity, tap "Annuler" in the snackbar: the item is back, ticked, with its quantity. | US2-6, US2-16 |
| `finish-shopping.e2e.ts` | "Terminer les courses", then "Annuler" changes nothing; again with "Terminer": every item is unticked and kept. | US1-8, US1-9 |
| `several-lists.e2e.ts` | With "Lait" ticked on "Ma liste", create "Barbecue", make it current from "Mes listes", add "Lait" (unticked there), switch back: "Ma liste" is untouched and "Lait" is still ticked on it. | US3-2, US3-3, US3-4, US3-8, US2-5 |

Device checks that need a person stay in [quickstart.md](../quickstart.md): airplane mode, the
screen readers, 200% text, release start time, and the visual review of the stories.
