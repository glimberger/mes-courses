#!/bin/sh
# Tests of the argument and precondition checks of pack-agent.sh. They all fail before `yarn` runs.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failures=0

mkdir -p "$work/apps/delivery"
printf '{\n  "name": "@mes-courses/delivery",\n  "version": "1.0.0",\n}\n' >"$work/apps/delivery/package.json"

expect_failure() {
  name=$1
  expected=$2
  shift 2
  message=$(env PACK_AGENT_ROOT="$work" "$@" 2>&1 >/dev/null)
  status=$?
  case "$message" in
    *"$expected"*) [ "$status" -ne 0 ] && echo "ok   $name" && return ;;
  esac
  echo "FAIL $name: status $status, message '$message'"
  failures=$((failures + 1))
}

expect_failure "no arguments" "usage" sh "$dir/pack-agent.sh"
expect_failure "not a version" "X.Y.Z" sh "$dir/pack-agent.sh" latest
expect_failure "path in the version" "X.Y.Z" sh "$dir/pack-agent.sh" 1.0.0/../x
expect_failure "version differs from the workspace" "not '1.2.0'" sh "$dir/pack-agent.sh" 1.2.0
expect_failure "nothing built" "yarn build" sh "$dir/pack-agent.sh" 1.0.0

[ "$failures" -eq 0 ] || exit 1
