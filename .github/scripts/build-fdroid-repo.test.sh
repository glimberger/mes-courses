#!/bin/sh
# Tests of the argument checks of build-fdroid-repo.sh. They all fail before `fdroid` is needed.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failures=0
: >"$work/app.apk"

expect_failure() {
  name=$1
  expected=$2
  shift 2
  message=$(env -i PATH="$PATH" "$@" 2>&1 >/dev/null)
  status=$?
  case "$message" in
    *"$expected"*) [ "$status" -ne 0 ] && echo "ok   $name" && return ;;
  esac
  echo "FAIL $name: status $status, message '$message'"
  failures=$((failures + 1))
}

script="sh $dir/build-fdroid-repo.sh"
good="SERVER_URL=https://x FDROID_KEYSTORE_BASE64=a FDROID_KEYSTORE_PASSWORD=b FDROID_KEY_PASSWORD=c"

expect_failure "no arguments" "usage" $script
expect_failure "unknown variant" "staging or production" $good $script qa "$work/app.apk" abc
expect_failure "missing apk" "does not exist" $good $script staging "$work/none.apk" abc
expect_failure "bad sha" "hexadecimal" $good $script staging "$work/app.apk" ../x
expect_failure "missing SERVER_URL" "SERVER_URL" FDROID_KEYSTORE_BASE64=a FDROID_KEYSTORE_PASSWORD=b FDROID_KEY_PASSWORD=c $script staging "$work/app.apk" abc
expect_failure "missing keystore password" "FDROID_KEYSTORE_PASSWORD" SERVER_URL=https://x FDROID_KEYSTORE_BASE64=a FDROID_KEY_PASSWORD=c $script staging "$work/app.apk" abc

[ "$failures" -eq 0 ] || exit 1
