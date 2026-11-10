#!/bin/sh
# Tests of release-bump.sh and of the release-bump rule of app-changed.sh, on a throwaway repository.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
failures=0
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
title="chore(release): bump the app version to 2.2.0"

git_() { git -C "$work" -c user.name=t -c user.email=t@t -c commit.gpgsign=false "$@"; }

git init -q "$work"
mkdir -p "$work/apps/mobile/src/changelog" "$work/apps/other"
cat >"$work/apps/mobile/app.config.ts" <<'CFG'
export default {
  name: 'Courses',
  version: '2.1.0',
  slug: 'courses',
  plugins: [
    {
      version: '1.0.0',
    },
  ],
};
CFG
echo "# Changelog" >"$work/CHANGELOG.md"
echo "[]" >"$work/apps/mobile/src/changelog/changelog.json"
echo "x" >"$work/apps/other/file.ts"
git_ add -A
git_ commit -q -m base
git_ tag pr-base

# reset_branch <name>: new branch from base
branch() { git_ checkout -q -B "$1" pr-base; }
# commit_all: commit the working tree changes and tag the result as head
finish() { git_ add -A && git_ commit -q -m change && git_ tag -f pr-tip >/dev/null; }

expect() {
  name=$1
  expected=$2
  t=$3
  output=$(cd "$work" && sh "$dir/release-bump.sh" "$t" pr-base pr-tip)
  if [ "$output" = "$expected" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: '$output'"
    failures=$((failures + 1))
  fi
}

expect_app() {
  name=$1
  expected=$2
  t=$3
  shift 3
  output=$(cd "$work" && git diff --name-only pr-base...pr-tip | sh "$dir/app-changed.sh" "$@" "$t" pr-base pr-tip)
  if [ "$output" = "$expected" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: '$output'"
    failures=$((failures + 1))
  fi
}

branch bump
sed -i.bak "s/version: '2.1.0'/version: '2.2.0'/" "$work/apps/mobile/app.config.ts" && rm "$work/apps/mobile/app.config.ts.bak"
finish
expect "version line only" bump=true "$title"
expect "version line only, other title" bump=false "feat: bump the app version"
expect "version line only, empty title" bump=false ""
expect_app "app-changed: bump is non-app" app=false "$title"
expect_app "app-changed: bump-like title only is app" app=true "feat: something"

branch bump-full
sed -i.bak "s/version: '2.1.0'/version: '2.2.0'/" "$work/apps/mobile/app.config.ts" && rm "$work/apps/mobile/app.config.ts.bak"
echo "- 2.2.0" >>"$work/CHANGELOG.md"
echo '[{"v":"2.2.0"}]' >"$work/apps/mobile/src/changelog/changelog.json"
finish
expect "version, changelog and changelog.json" bump=true "$title"

branch bare-changelog-data
echo '[{"v":"2.2.0"}]' >"$work/changelog.json"
finish
expect "a bare changelog.json at the root is not the changelog data" bump=false "$title"

branch other-file
sed -i.bak "s/version: '2.1.0'/version: '2.2.0'/" "$work/apps/mobile/app.config.ts" && rm "$work/apps/mobile/app.config.ts.bak"
echo "y" >>"$work/apps/other/file.ts"
finish
expect "bump title, another file changed" bump=false "$title"
expect_app "app-changed: bump title with another file is app" app=true "$title"

branch other-line
sed -i.bak "s/version: '2.1.0'/version: '2.2.0'/; s/name: 'Courses'/name: 'Shop'/" "$work/apps/mobile/app.config.ts" && rm "$work/apps/mobile/app.config.ts.bak"
finish
expect "bump title, another line of app.config.ts" bump=false "$title"
expect_app "app-changed: another line of app.config.ts is app" app=true "$title"

branch no-version
sed -i.bak "s/name: 'Courses'/name: 'Shop'/" "$work/apps/mobile/app.config.ts" && rm "$work/apps/mobile/app.config.ts.bak"
finish
expect "bump title, no version change" bump=false "$title"

branch extra-version-line
sed -i.bak "s/version: '2.1.0',/version: '2.2.0',\n  version: '2.3.0',/" "$work/apps/mobile/app.config.ts" && rm "$work/apps/mobile/app.config.ts.bak"
finish
expect "bump title, added second version line" bump=false "$title"

branch nested-version
sed -i.bak "s/      version: '1.0.0'/      version: '1.1.0'/" "$work/apps/mobile/app.config.ts" && rm "$work/apps/mobile/app.config.ts.bak"
finish
expect "bump title, only a nested version line changed" bump=false "$title"

branch changelog-only
echo "- note" >>"$work/CHANGELOG.md"
finish
expect "changelog only" bump=true "$title"

branch empty
git_ commit -q --allow-empty -m empty && git_ tag -f pr-tip >/dev/null
expect "no change" bump=false "$title"

output=$(cd "$work" && sh "$dir/release-bump.sh" "$title" "" "")
if [ "$output" = bump=false ]; then echo "ok   missing refs"; else echo "FAIL missing refs: '$output'"; failures=$((failures + 1)); fi
output=$(cd "$work" && sh "$dir/release-bump.sh" "$title" nope nope)
if [ "$output" = bump=false ]; then echo "ok   unknown refs"; else echo "FAIL unknown refs: '$output'"; failures=$((failures + 1)); fi

# app-changed.sh without arguments keeps its path rule.
check_paths() {
  name=$1
  expected=$2
  input=$3
  output=$(printf '%s' "$input" | sh "$dir/app-changed.sh")
  if [ "$output" = "$expected" ]; then echo "ok   $name"; else echo "FAIL $name: '$output'"; failures=$((failures + 1)); fi
}
check_paths "docs only" app=false "specs/a/b.md
README.md
.specify/x"
check_paths "app.config.ts without bump arguments" app=true "apps/mobile/app.config.ts"
check_paths "no input" app=true ""

[ "$failures" -eq 0 ] || { echo "$failures failure(s)"; exit 1; }
echo "all passed"
