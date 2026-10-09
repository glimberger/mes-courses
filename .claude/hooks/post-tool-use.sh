#!/usr/bin/env bash
# PostToolUse hook: right after a JavaScript or TypeScript file is edited, runs ESLint on that
# file and the type checker of its workspace, and hands any error back to the agent (exit code
# 2) so it fixes it now rather than at commit time or in CI.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
guardrails_off && exit 0
require_jq

input=$(cat)
file=$(jq -r '.tool_input.file_path // empty' <<<"$input")
case "$file" in
  *.js | *.cjs | *.mjs | *.jsx | *.ts | *.cts | *.mts | *.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
top=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
# A worktree without its dependencies installed cannot run the checks.
[ -d "$top/node_modules" ] || exit 0

errors=""
if ! out=$(cd "$top" && yarn eslint --no-warn-ignored "$file" 2>&1); then
  errors+="ESLint:"$'\n'"$(tail -n 30 <<<"$out")"$'\n'
fi

# The closest package.json with a typecheck script names the workspace to type check.
dir=$(dirname "$file")
while [ "$dir" != "$top" ] && [ "$dir" != / ]; do
  if [ -f "$dir/package.json" ] && jq -e '.scripts.typecheck' "$dir/package.json" >/dev/null; then
    if ! out=$(cd "$dir" && yarn typecheck 2>&1); then
      errors+="TypeScript ($(jq -r .name "$dir/package.json")):"$'\n'"$(tail -n 30 <<<"$out")"$'\n'
    fi
    break
  fi
  dir=$(dirname "$dir")
done

if [ -n "$errors" ]; then
  printf 'Checks failed after editing %s. Fix them before moving on.\n%s' "${file#"$top"/}" "$errors" >&2
  exit 2
fi
exit 0
