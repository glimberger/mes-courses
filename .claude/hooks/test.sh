#!/usr/bin/env bash
# Tests of pre-tool-use.sh against a throwaway repository. Run with `yarn test:hooks`.
set -uo pipefail
hook="$(cd "$(dirname "$0")" && pwd)/pre-tool-use.sh"
repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT
failures=0

git -C "$repo" init -q -b main
git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
mkdir -p "$repo/.specify" "$repo/specs/003-sync" "$repo/apps/server"
echo '{"feature_directory": "specs/003-sync"}' >"$repo/.specify/feature.json"
printf '# Scope\napps/server/*\npackage.json  # root manifest\n' >"$repo/specs/003-sync/agent-scope.txt"

run() {
  local tool=$1 field=$2 value=$3
  jq -n --arg tool "$tool" --arg field "$field" --arg value "$value" --arg cwd "$repo" \
    '{tool_name: $tool, cwd: $cwd, tool_input: {($field): $value}}' |
    CLAUDE_PROJECT_DIR=$repo "$hook" 2>/dev/null
}

expect() {
  local want=$1 name=$2
  shift 2
  run "$@"
  local got=$?
  if [ "$got" = "$want" ]; then
    printf 'ok   %s\n' "$name"
  else
    printf 'FAIL %s (exit %s, expected %s)\n' "$name" "$got" "$want"
    failures=$((failures + 1))
  fi
}

edit() { expect "$1" "$2" Edit file_path "$repo/$3"; }
bash_cmd() { expect "$1" "$2" Bash command "$3"; }

echo '# On main'
edit 2 'edit on main' apps/server/a.ts
bash_cmd 2 'commit on main' 'git commit -m x'
bash_cmd 2 'push from main' 'git push'
bash_cmd 0 'read-only git on main' 'git status'

git -C "$repo" switch -q -c chore/other
echo '# On chore/other (not the feature branch: no scope)'
edit 0 'edit anywhere' README.md
edit 0 'edit outside the repository' ../elsewhere.txt
edit 2 'edit settings.json' .claude/settings.json
edit 2 'edit a hook' .claude/hooks/stop.sh
edit 2 'edit lefthook.yml' lefthook.yml
edit 2 'edit a workflow' .github/workflows/ci.yml
edit 2 'edit the scope file' specs/003-sync/agent-scope.txt
edit 0 'edit settings.local.json' .claude/settings.local.json

git -C "$repo" switch -q -c feat/003-sync
echo '# On feat/003-sync (scope applies)'
edit 0 'edit in scope' apps/server/src/deep/a.ts
edit 0 'edit a listed file' package.json
edit 0 'edit the feature folder' specs/003-sync/tasks.md
edit 2 'edit out of scope' apps/mobile/src/a.ts
edit 2 'create out of scope in a new folder' packages/new/src/a.ts

echo '# Bash commands'
bash_cmd 0 'plain commit' 'git commit -m "feat: x"'
bash_cmd 0 'commit with heredoc' $'git commit -F - <<\'EOF\'\nfeat: x\nEOF'
bash_cmd 2 'commit --no-verify' 'git commit --no-verify -m x'
bash_cmd 2 'commit -n' 'git commit -n -m x'
bash_cmd 2 'commit -am then -n' 'git commit -a -n -m x'
bash_cmd 2 'LEFTHOOK=0' 'LEFTHOOK=0 git commit -m x'
bash_cmd 2 'hooksPath override' 'git -c core.hooksPath=/dev/null commit -m x'
bash_cmd 0 'push the feature branch' 'git push -u origin feat/003-sync'
bash_cmd 0 'push with lease' 'git push --force-with-lease'
bash_cmd 2 'push --force' 'git push --force'
bash_cmd 2 'push -f' 'git push -f origin feat/003-sync'
bash_cmd 2 'push +refspec' 'git push origin +feat/003-sync'
bash_cmd 2 'push to main' 'git push origin HEAD:main'
bash_cmd 2 'push --no-verify' 'git push --no-verify'
bash_cmd 2 'gh pr merge' 'gh pr merge 12 --squash'
bash_cmd 0 'gh pr view' 'gh pr view 12'
bash_cmd 0 'read a guardrail file' 'cat lefthook.yml 2>&1'
bash_cmd 0 'run a hook' 'echo {} | .claude/hooks/stop.sh 2>&1'
bash_cmd 2 'redirect into a guardrail file' 'echo x >> lefthook.yml'
bash_cmd 2 'tee into a guardrail file' 'echo x | tee .claude/settings.json'
bash_cmd 2 'sed -i a guardrail file' "sed -i '' s/a/b/ .github/workflows/ci.yml"
bash_cmd 2 'remove a hook' 'rm .claude/hooks/stop.sh'
bash_cmd 2 'restore a guardrail file' 'git checkout origin/main -- .talismanrc'

echo '# Escape hatch'
if jq -n --arg cwd "$repo" '{tool_name: "Edit", cwd: $cwd, tool_input: {file_path: ($cwd + "/lefthook.yml")}}' |
  CLAUDE_GUARDRAILS_OFF=1 CLAUDE_PROJECT_DIR=$repo "$hook"; then
  echo 'ok   CLAUDE_GUARDRAILS_OFF=1 allows everything'
else
  echo 'FAIL CLAUDE_GUARDRAILS_OFF=1 allows everything'
  failures=$((failures + 1))
fi

[ "$failures" = 0 ] && echo 'All hook tests passed.' || {
  echo "$failures hook test(s) failed."
  exit 1
}
