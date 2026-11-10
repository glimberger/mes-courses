#!/bin/sh
# Tests of the argument checks of pack-server.sh. They all fail before `pnpm` runs. The packing
# itself needs a built workspace and is covered by the staging delivery.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
failures=0

expect_failure() {
  name=$1
  expected=$2
  shift 2
  message=$("$@" 2>&1 >/dev/null)
  status=$?
  case "$message" in
    *"$expected"*) [ "$status" -ne 0 ] && echo "ok   $name" && return ;;
  esac
  echo "FAIL $name: status $status, message '$message'"
  failures=$((failures + 1))
}

commit=$(printf 'a%.0s' $(seq 1 40))

expect_failure "no arguments" "usage" sh "$dir/pack-server.sh"
expect_failure "the old three-argument form" "usage" sh "$dir/pack-server.sh" 1.2.0 "$commit" 12
expect_failure "not a commit" "40 lowercase hex" sh "$dir/pack-server.sh" latest
expect_failure "too short a commit" "40 lowercase hex" sh "$dir/pack-server.sh" abc123
expect_failure "uppercase commit" "40 lowercase hex" sh "$dir/pack-server.sh" "$(printf 'A%.0s' $(seq 1 40))"
expect_failure "path in the commit" "40 lowercase hex" sh "$dir/pack-server.sh" "../$commit"

# Nothing environment-specific is baked in (ADR-0015): the script no longer writes build-info.json.
if grep -v '^#' "$dir/pack-server.sh" | grep -q 'build-info'; then
  echo "FAIL pack-server.sh still writes build-info.json"
  failures=$((failures + 1))
else
  echo "ok   no build-info.json in the archive"
fi

[ "$failures" -eq 0 ] || exit 1
