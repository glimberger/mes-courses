# Changelog

## [2.1.0] - 2026-11-09

### Nouveautés

- rename and delete a shopping list from the lists screen ([#193](https://github.com/glimberger/mes-courses/pull/193))

## [2.0.1] - 2026-11-07

### Nouveautés

- bottom tab navigation with nested stacks ([#177](https://github.com/glimberger/mes-courses/pull/177))
- Courses tab row menu, square checkbox and struck-through in-cart rows ([#178](https://github.com/glimberger/mes-courses/pull/178))
- Listes tab "en cours" chip and tap to make a list current ([#179](https://github.com/glimberger/mes-courses/pull/179))
- Articles tab for global catalog management ([#180](https://github.com/glimberger/mes-courses/pull/180))
- tap-to-add on the add-articles screen ([#181](https://github.com/glimberger/mes-courses/pull/181))

### Corrections

- mobile containment ([#160](https://github.com/glimberger/mes-courses/pull/160))
- keep the password field above the keyboard on Android ([#162](https://github.com/glimberger/mes-courses/pull/162))
- declare babel-preset-expo so the CI APK build resolves it ([#182](https://github.com/glimberger/mes-courses/pull/182))

## [1.2.0] - 2026-10-19

### Nouveautés

- add Result, name and quantity rules and entity types (T018-T024) ([#43](https://github.com/glimberger/mes-courses/pull/43))
- add driven ports, contract suites and in-memory fakes (T025-T029) ([#45](https://github.com/glimberger/mes-courses/pull/45))
- add the SQLite adapter, migrations and storage errors (T030-T035) ([#46](https://github.com/glimberger/mes-courses/pull/46))
- add the initializeStore use case (T036-T037) ([#47](https://github.com/glimberger/mes-courses/pull/47))
- add the Sentry and console error reporters and the crypto id generator (T038-T040) ([#48](https://github.com/glimberger/mes-courses/pull/48))
- add the theme, the screen state components and formatQuantity (T041-T046) ([#50](https://github.com/glimberger/mes-courses/pull/50))
- add the application store core, its write rules and NoticeSnackbar (T047-T053) ([#51](https://github.com/glimberger/mes-courses/pull/51))
- add the app shell, story store and composition root (T054-T064) ([#53](https://github.com/glimberger/mes-courses/pull/53))
- show and tick the current list, and finish shopping (T065-T083) ([#54](https://github.com/glimberger/mes-courses/pull/54))
- add articles to the list, change their quantity and remove them with undo (T084-T107) ([#56](https://github.com/glimberger/mes-courses/pull/56))
- manage several named lists and choose the current one (T108-T118) ([#57](https://github.com/glimberger/mes-courses/pull/57))
- create categories from the article form (T119-T127) ([#60](https://github.com/glimberger/mes-courses/pull/60))
- polish the shopping lists for release (T128-T143) ([#63](https://github.com/glimberger/mes-courses/pull/63))
- repositories, article row menu and CategoryPicker (T001-T009) ([#65](https://github.com/glimberger/mes-courses/pull/65))
- rename an article from the catalog (US1) ([#66](https://github.com/glimberger/mes-courses/pull/66))
- delete an article from the catalog with undo (US2) ([#67](https://github.com/glimberger/mes-courses/pull/67))
- change an article's category from the edit screen (US3) ([#68](https://github.com/glimberger/mes-courses/pull/68))
- sync-core HLC, merge, shared names and protocol types (T008-T013) ([#75](https://github.com/glimberger/mes-courses/pull/75))
- server ports, stores, migrations, crypto and error reporting (T014-T021) ([#77](https://github.com/glimberger/mes-courses/pull/77))
- server pairing, HTTP app and entry points (T022-T027) ([#79](https://github.com/glimberger/mes-courses/pull/79))
- app migration, ports, adapters and connectToServer ([#80](https://github.com/glimberger/mes-courses/pull/80))
- US1 single-device sync, settings screens and server merge-by-name ([#81](https://github.com/glimberger/mes-courses/pull/81))
- US2 multi-device convergence and remote-removal handling ([#82](https://github.com/glimberger/mes-courses/pull/82))
- US3 sync status bar, Synchroniser maintenant and focus after a pull ([#84](https://github.com/glimberger/mes-courses/pull/84))
- US4 device management, revocation and server address change ([#85](https://github.com/glimberger/mes-courses/pull/85))
- polish deployment, privacy, accessibility and offline checks ([#88](https://github.com/glimberger/mes-courses/pull/88))
- multi-user accounts ([#104](https://github.com/glimberger/mes-courses/pull/104))
- continuous delivery to staging and production on the Pi ([#109](https://github.com/glimberger/mes-courses/pull/109))
- add branded startup splash screen ([#124](https://github.com/glimberger/mes-courses/pull/124))
- basket-identity UI refresh ([#126](https://github.com/glimberger/mes-courses/pull/126))
- make the UI faithful to the mockups ([#128](https://github.com/glimberger/mes-courses/pull/128))
- let the user choose the app theme manually ([#136](https://github.com/glimberger/mes-courses/pull/136))

### Corrections

- turn off Sentry's Android ANR reports ([#49](https://github.com/glimberger/mes-courses/pull/49))
- skip the Sentry upload in local builds ([#55](https://github.com/glimberger/mes-courses/pull/55))
- ignore taps in QuantityDialog while a save runs ([#58](https://github.com/glimberger/mes-courses/pull/58))
- let the compiled server load sync-core on the Pi ([#89](https://github.com/glimberger/mes-courses/pull/89))
- treat 502-504 as unreachable and sync when the network returns ([#97](https://github.com/glimberger/mes-courses/pull/97))
- release follow-ups for server sync (T115-T117) ([#98](https://github.com/glimberger/mes-courses/pull/98))
- keep check output out of the exported `out` variable ([#87](https://github.com/glimberger/mes-courses/pull/87))
- close remaining guardrail gaps from third review round ([#100](https://github.com/glimberger/mes-courses/pull/100))
- leave oxc-parser out of the server artifact ([#110](https://github.com/glimberger/mes-courses/pull/110))
- point the agent unit at the bundle's real entry point ([#111](https://github.com/glimberger/mes-courses/pull/111))
- leave oxc-parser out of the agent artifact ([#112](https://github.com/glimberger/mes-courses/pull/112))
- move the staging instance to port 3002 ([#114](https://github.com/glimberger/mes-courses/pull/114))
- keep a manifest unhandled while its F-Droid repository waits for a healthy server ([#115](https://github.com/glimberger/mes-courses/pull/115))
- load agent.env in the agent shell function so manual commands reach Sentry ([#121](https://github.com/glimberger/mes-courses/pull/121))
- never let a timer pass and a manual deploy-file work at the same time ([#122](https://github.com/glimberger/mes-courses/pull/122))
- size the sign-in brand image through its style ([#127](https://github.com/glimberger/mes-courses/pull/127))
- keep account row text readable under a wide badge ([#133](https://github.com/glimberger/mes-courses/pull/133))
- pin the sign-in button outside the scroll view and rename the hidden title ([#135](https://github.com/glimberger/mes-courses/pull/135))
- stop striking through the text of ticked list items ([#137](https://github.com/glimberger/mes-courses/pull/137))
- show the sign-in error above the button and unblock E2E Android ([#140](https://github.com/glimberger/mes-courses/pull/140))
