#!/usr/bin/env bash
# Stop hook: when the agent is about to end its turn with uncommitted changes to code, runs the
# repository checks (typecheck, unit tests, architecture rules). If one fails, the agent is sent
# back to work (exit code 2) instead of reporting a task as done while the tree is red.
#
# A turn that changed nothing is skipped, and a green state is remembered by fingerprint, so a turn that changed nothing since the last
# green run costs nothing. The agent is sent back only once per turn (stop_hook_active), which
# rules out an endless loop: if it still cannot fix the checks, it stops and says so.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
guardrails_off && exit 0
require_jq

input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0
cwd=$(jq -r '.cwd // empty' <<<"$input")
top=$(git -C "${cwd:-${CLAUDE_PROJECT_DIR:-.}}" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -d "$top/node_modules" ] || exit 0
cd "$top" || exit 0

# Changed or new files, documentation and specs aside.
changed=$(git status --porcelain --untracked-files=all | cut -c4- |
  grep -Ev '\.md$|^specs/|^docs/|^design/|^\.specify/' || true)
[ -n "$changed" ] || exit 0

fingerprint=$(tree_fingerprint)
state_dir=$(git rev-parse --path-format=absolute --git-path claude-guardrails)
# The tree as it was when the user's prompt arrived (prompt-submit.sh): a turn that left it
# unchanged is not checked, so the user's own work in progress never sends the agent back.
[ "$(cat "$state_dir/turn-start" 2>/dev/null)" = "$fingerprint" ] && exit 0
cache=$state_dir/stop-ok
[ "$(cat "$cache" 2>/dev/null)" = "$fingerprint" ] && exit 0

for check in typecheck test test:architecture; do
  if ! out=$(yarn "$check" 2>&1); then
    {
      printf 'Blocked by .claude/hooks: `yarn %s` fails on the current changes.\n' "$check"
      printf 'Fix it before ending the turn, or tell the user what is still failing and why.\n\n'
      printf '%s\n' "$out" | tail -n 80
    } >&2
    exit 2
  fi
done

mkdir -p "$(dirname "$cache")"
printf '%s\n' "$fingerprint" >"$cache"
exit 0
