#!/usr/bin/env bash
# UserPromptSubmit hook: records the state of the working tree when a turn starts, so that
# stop.sh can tell what the agent changed during the turn.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
guardrails_off && exit 0

input=$(cat)
cwd=$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)
cd "${cwd:-${CLAUDE_PROJECT_DIR:-.}}" 2>/dev/null || exit 0
git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0
state_dir=$(git rev-parse --path-format=absolute --git-path claude-guardrails)
mkdir -p "$state_dir"
tree_fingerprint >"$state_dir/turn-start"
exit 0
