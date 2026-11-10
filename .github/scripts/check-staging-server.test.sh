#!/bin/sh
# Tests of check-staging-server.sh: the checksum comparison of the production release.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failures=0

printf 'server archive' >"$work/server.tar.gz"
if command -v sha256sum >/dev/null 2>&1; then
  good=$(sha256sum "$work/server.tar.gz" | cut -d ' ' -f 1)
else
  good=$(shasum -a 256 "$work/server.tar.gz" | cut -d ' ' -f 1)
fi
other=$(printf '0%.0s' $(seq 1 64))

expect() {
  name=$1
  want_status=$2
  want_text=$3
  shift 3
  output=$("$@" 2>&1)
  status=$?
  case "$output" in
    *"$want_text"*) [ "$status" -eq "$want_status" ] && echo "ok   $name" && return ;;
  esac
  echo "FAIL $name: status $status, output '$output'"
  failures=$((failures + 1))
}

expect "matching checksum" 0 "byte-identical" sh "$dir/check-staging-server.sh" "$work/server.tar.gz" "$good"
expect "different checksum" 1 "does not match the staging manifest" sh "$dir/check-staging-server.sh" "$work/server.tar.gz" "$other"
expect "the message names both checksums" 1 "checksum $good, expected $other" sh "$dir/check-staging-server.sh" "$work/server.tar.gz" "$other"
expect "missing archive" 1 "does not rebuild" sh "$dir/check-staging-server.sh" "$work/absent.tar.gz" "$good"
expect "malformed expected checksum" 2 "64 lowercase hex" sh "$dir/check-staging-server.sh" "$work/server.tar.gz" "abc"
expect "no arguments" 2 "usage" sh "$dir/check-staging-server.sh"

[ "$failures" -eq 0 ] || exit 1
