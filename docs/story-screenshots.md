# Story screenshots

`yarn screenshots:ios` and `yarn screenshots:android` build the app in a screenshot mode (every
story full screen, one at a time, `STORYBOOK_ENABLED=true STORY_SHOTS=true`) and capture each
story in the light and the dark scheme with Detox, into `tests/e2e/artifacts/shots/`
(`<platform>-<scheme>/<Story-id with / as ->.png`). They replace the release build at the same
paths, so `yarn test:e2e:*` builds again before it runs. Run them one platform at a time.
With `SHOTS_STORIES`, the walk stops once every listed story is captured. Skip the build only when
the last build was a screenshot build and nothing native or in the dependencies changed since.

| Variable           | Default           | What it does                                                           |
| ------------------ | ----------------- | ---------------------------------------------------------------------- |
| `SHOTS_OUT`        | `artifacts/shots` | The output folder                                                      |
| `SHOTS_STORIES`    | every story       | A file with one story id per line (blank lines and `#` ignored)        |
| `SHOTS_SCHEMES`    | `light,dark`      | `light`, `dark`, or both                                               |
| `SHOTS_SKIP_BUILD` | unset             | Set to any value to skip the build and reuse the last screenshot build |

The screenshot mode is a build of its own: a normal build has none of its code. They serve the
review of a pull request that changes screens or dialogs.
