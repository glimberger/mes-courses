# Data Model: Bottom Tab Navigation and Tap-to-Add Flow

No change to the domain model, the storage schema or the synchronization protocol. The feature adds UI-only state.

| State | Owner | Lifetime | Content |
| --- | --- | --- |  --- |
| Visit snapshot | add screen | until the screen closes | ids of the articles on the list when the screen opened (hidden rows) |
| Visit set | add screen | until the screen closes | ids of the articles added during the visit (shown, marked) |
| Article usage | Articles tab, edit and delete dialogs | read when displayed | number of lists holding each article, from `get-article-usage` |
| Selected tab and per-tab history | navigator | session | React Navigation state, not persisted |

Visible rows on the add screen = catalog articles matching the search, minus (visit snapshot minus visit set).
