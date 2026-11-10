#!/bin/sh
# Usage: release-bump.sh <pull request title> <base> <head>
# Prints "bump=true" when the change from <base> to <head> (merge-base diff) is a release bump,
# and "bump=false" otherwise. It decides from the diff, never from the title alone. All of these
# must hold:
#   - the title starts with "chore(release): bump";
#   - at least one file changed, and every one is apps/mobile/app.config.ts, CHANGELOG.md or
#     changelog.json;
#   - the only change in apps/mobile/app.config.ts is its top-level (two-space indented) `version: '...'`
#     line.
# Any doubt (missing argument, git failure) gives "bump=false", so the full CI runs.
# Used by .github/workflows/ci.yml and .github/scripts/app-changed.sh.

config=apps/mobile/app.config.ts
# Anchored on the two-space indentation of the top-level key, so a nested `version:` does not count.
version_line="^[-+]  version:[[:space:]]*'[^']*',?[[:space:]]*$"

decide() {
  title=$1
  base=$2
  head=$3
  [ -n "$base" ] && [ -n "$head" ] || return 1
  case "$title" in
    "chore(release): bump"*) ;;
    *) return 1 ;;
  esac
  files=$(git diff --name-only "$base...$head") || return 1
  [ -n "$files" ] || return 1
  for file in $files; do
    case "$file" in
      "$config" | CHANGELOG.md | changelog.json) ;;
      *) return 1 ;;
    esac
  done
  # Changed lines of the app configuration, without the file headers.
  changed=$(git diff -U0 "$base...$head" -- "$config" | grep -E '^[-+]' | grep -Ev '^(\+\+\+|---)') || changed=
  if [ -n "$changed" ]; then
    printf '%s\n' "$changed" | grep -Evq "$version_line" && return 1
    removed=$(printf '%s\n' "$changed" | grep -c '^-')
    added=$(printf '%s\n' "$changed" | grep -c '^+')
    [ "$removed" -eq 1 ] && [ "$added" -eq 1 ] || return 1
  fi
  return 0
}

if decide "$1" "$2" "$3" 2>/dev/null; then
  echo "bump=true"
else
  echo "bump=false"
fi
