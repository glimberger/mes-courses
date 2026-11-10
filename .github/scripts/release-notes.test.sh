#!/bin/sh
# Tests of release-notes.sh on a CHANGELOG.md fixture.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
failures=0
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

cat >"$work/CHANGELOG.md" <<'MD'
# Changelog

## [2.1.0] - 2026-11-01

### Nouveautés

- Add the version in Settings ([#205](https://example.test/pull/205))

### Corrections

- Fix the sync URL

## [2.0.1] - 2026-10-01

### Corrections

- Fix a crash

## [2.0.10] - 2026-09-01

### Nouveautés

- Tenth patch

## [1.2.0] - 2026-08-01
MD

check() {
  name=$1
  expected_out=$2
  expected_code=$3
  expected_err=$4
  shift 4
  out=$(sh "$dir/release-notes.sh" "$@" 2>"$work/err")
  code=$?
  err=$(cat "$work/err")
  if [ "$out" = "$expected_out" ] && [ "$code" -eq "$expected_code" ] && [ "$err" = "$expected_err" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: code=$code out='$out' err='$err'"
    failures=$((failures + 1))
  fi
}

check "newest section, without its heading and trimmed" "### Nouveautés

- Add the version in Settings ([#205](https://example.test/pull/205))

### Corrections

- Fix the sync URL" 0 "" 2.1.0 "$work/CHANGELOG.md"
check "middle section stops at the next heading" "### Corrections

- Fix a crash" 0 "" 2.0.1 "$work/CHANGELOG.md"
check "exact match: 2.0.1 is not 2.0.10" "### Nouveautés

- Tenth patch" 0 "" 2.0.10 "$work/CHANGELOG.md"
check "missing version" "" 1 "No changelog section for 9.9.9 in $work/CHANGELOG.md" 9.9.9 "$work/CHANGELOG.md"
check "empty last section" "" 1 "No changelog section for 1.2.0 in $work/CHANGELOG.md" 1.2.0 "$work/CHANGELOG.md"
check "version prefix is not a match" "" 1 "No changelog section for 2.0 in $work/CHANGELOG.md" 2.0 "$work/CHANGELOG.md"
check "no argument" "" 2 "Usage: release-notes.sh <X.Y.Z> [CHANGELOG.md]" 
check "missing file" "" 2 "No such file: $work/none.md" 2.1.0 "$work/none.md"

[ "$failures" -eq 0 ] || { echo "$failures failure(s)"; exit 1; }
echo "all passed"
