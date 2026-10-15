#!/bin/sh
# Tests of repo-address.sh. The QR code is not tested: qrencode is not needed to print the address.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
failures=0
script="sh $dir/repo-address.sh"
fingerprint=$(printf 'AB%.0s' $(seq 1 32))
lower=$(printf 'ab%.0s' $(seq 1 32))
colons=$(printf 'AB:%.0s' $(seq 1 31))AB

expect_output() {
  name=$1
  expected=$2
  shift 2
  output=$(env -i PATH="$PATH" "$@" 2>/dev/null)
  status=$?
  if [ "$status" -eq 0 ] && [ "$output" = "$expected" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: status $status, output '$output'"
    failures=$((failures + 1))
  fi
}

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

expect_output "plain fingerprint" "https://courses.example.org/fdroid/repo?fingerprint=$lower" \
  SERVER_URL=https://courses.example.org FDROID_FINGERPRINT="$fingerprint" $script production --no-qr
expect_output "colon separated fingerprint, trailing slash" "https://staging.example.org/fdroid/repo?fingerprint=$lower" \
  SERVER_URL=https://staging.example.org/ FDROID_FINGERPRINT="$colons" $script staging --no-qr

expect_failure "no arguments" "usage" $script
expect_failure "unknown environment" "staging or production" SERVER_URL=https://x FDROID_FINGERPRINT="$fingerprint" $script qa
expect_failure "missing SERVER_URL" "SERVER_URL" FDROID_FINGERPRINT="$fingerprint" $script staging --no-qr
expect_failure "http address" "https" SERVER_URL=http://x FDROID_FINGERPRINT="$fingerprint" $script staging --no-qr
expect_failure "missing fingerprint" "FDROID_FINGERPRINT" SERVER_URL=https://x $script staging --no-qr
expect_failure "short fingerprint" "64 hexadecimal" SERVER_URL=https://x FDROID_FINGERPRINT=abcd $script staging --no-qr

[ "$failures" -eq 0 ] || exit 1
