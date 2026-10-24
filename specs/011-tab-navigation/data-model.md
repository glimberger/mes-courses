# Data Model: Bottom Tab Navigation and Tap-to-Add Flow

No change to the domain model, the storage schema or the synchronization protocol. The feature adds UI-only state and two read or write use cases that need no new table: `get-article-usage-counts` (batch read) and `create-article` (catalog-only creation).

| State | Owner | Lifetime | Content |
| --- | --- | --- |  --- |
| Visit snapshot | add screen | until the screen closes | ids of the articles on the list when the screen opened (hidden rows) |
| Visit set | add screen | until the screen closes | ids of the articles added during the visit (shown, marked), including an article created through "Créer « xyz »" (received as `createdArticleId` on return) |
| Article usage | edit and delete dialogs | read when displayed | the lists holding one article, from `get-article-usage` |
| Usage counts | Articles tab | read on load and refresh | number of lists holding each article, from one batch read (`get-article-usage-counts`) |
| Selected tab and per-tab history | navigator | session | React Navigation state, not persisted |

Visible rows on the add screen = catalog articles matching the search, minus (visit snapshot minus visit set). An article created from the add screen is added to the visit set on return, so it is visible and marked.
