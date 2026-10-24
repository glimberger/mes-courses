# Agent guardrails

`.claude/settings.json` bounds what Claude Code agents can do in this repository. Its rules
and hooks apply to every session started here; the hooks need `git`, `jq` (in the Nix dev shell; without it they block every edit and command) and `pnpm`.

- **Denied commands**: force push, `--no-verify`, `gh pr merge` and reading `.env` files are
  refused outright.
- **Before a tool call** (`.claude/hooks/pre-tool-use.sh`): no file edit on `main` or a detached
  HEAD, no commit or push from `main`, no push to `main`, no force push (`--force-with-lease` is
  allowed), no skipping the Git hooks (`--no-verify`, `-n`, `LEFTHOOK=0`, `core.hooksPath`), no PR
  merge, and no change to the guardrail files: `.claude/settings.json`, `.claude/settings.local.json`, `.claude/hooks/`,
  `lefthook.yml`, `.github/workflows/`, `.dependency-cruiser.cjs` and the
  feature scope files. Only you edit those. Anything inside a `.git` directory is covered too,
  except `.git/gl-pr-loop/`, where the PR review loop keeps its state (no hook, no config): an
  agent may edit files there, and `rm` them as long as every path of that `rm` is in the folder.
- **Feature scope**: on a Spec Kit feature branch (`feat/003-...` for `specs/003-...`), if the
  feature folder holds an `agent-scope.txt`, edits are limited to that folder and the paths it
  lists, one glob per line (`*` also matches `/`, `#` starts a comment):
  ```text
  apps/server/*
  packages/sync-core/*
  package.json
  ```
- **After an edit** (`post-tool-use.sh`): ESLint on the edited JavaScript or TypeScript file and
  `tsc` on its workspace. Errors go straight back to the agent.
- **Before the agent ends its turn** (`stop.sh`): when code changed and is not committed,
  `pnpm typecheck`, `pnpm test` and `pnpm test:architecture` run (about 30 seconds). Only
  changes made during the turn count: `prompt-submit.sh` records the tree when you send a prompt,
  so your own work in progress never sends the agent back. A failure sends the agent back to
  work once; a green state is cached until the tree changes again.

The Bash checks are heuristics on the command text: they catch mistakes, not an agent set on
getting around them. To work without the hooks for one session, start it with
`CLAUDE_GUARDRAILS_OFF=1 claude`. An agent cannot set that variable itself.
