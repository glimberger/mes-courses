#!/bin/sh
# Tests of server-native-check.sh against fixture folders.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failures=0

expect() {
  name=$1
  want=$2
  folder=$3
  if sh "$dir/server-native-check.sh" "$folder" >/dev/null 2>&1; then got=0; else got=1; fi
  if [ "$got" = "$want" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: expected exit $want, got $got"
    failures=$((failures + 1))
  fi
}

mkdir -p "$work/clean/pkg" "$work/node/pkg/build" "$work/gyp/pkg"
echo 'module.exports = 1' >"$work/clean/pkg/index.js"
: >"$work/node/pkg/build/x.node"
echo '{}' >"$work/gyp/pkg/binding.gyp"

expect "clean modules pass" 0 "$work/clean"
expect "a .node file fails" 1 "$work/node"
expect "a binding.gyp fails" 1 "$work/gyp"
expect "a missing folder fails" 1 "$work/absent"
if sh "$dir/server-native-check.sh" >/dev/null 2>&1; then
  echo "FAIL no argument should fail"
  failures=$((failures + 1))
else
  echo "ok   no argument fails"
fi

[ "$failures" -eq 0 ] || exit 1
