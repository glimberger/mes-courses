#!/bin/sh
# Tests of delivery-summary.sh.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
failures=0
script="sh $dir/delivery-summary.sh"
summary=$(mktemp)
trap 'rm -f "$summary"' EXIT

expect_line() {
  name=$1
  expected=$2
  shift 2
  : >"$summary"
  env -i PATH="$PATH" GITHUB_STEP_SUMMARY="$summary" "$@" >/dev/null 2>&1
  status=$?
  if [ "$status" -eq 0 ] && [ "$(cat "$summary")" = "$expected" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: status $status, summary '$(cat "$summary")'"
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

expect_line "outcome without a url" "- abc123, staging, server, success" \
  SHA=abc123 DELIVERY_ENVIRONMENT=staging $script server success
expect_line "outcome with a url" "- abc123, production, android, failure (https://example.org/run/1)" \
  SHA=abc123 DELIVERY_ENVIRONMENT=production $script android failure https://example.org/run/1
expect_line "skipped" "- abc123, staging, android, skipped" \
  SHA=abc123 DELIVERY_ENVIRONMENT=staging $script android skipped

expect_failure "no arguments" "usage" SHA=a DELIVERY_ENVIRONMENT=staging $script
expect_failure "missing SHA" "SHA" DELIVERY_ENVIRONMENT=staging $script server success
expect_failure "unknown environment" "staging or production" SHA=a DELIVERY_ENVIRONMENT=qa $script server success
expect_failure "unknown outcome" "outcome" SHA=a DELIVERY_ENVIRONMENT=staging $script server maybe

# Without GITHUB_STEP_SUMMARY the line goes to the standard output.
output=$(env -i PATH="$PATH" SHA=abc DELIVERY_ENVIRONMENT=staging $script server success 2>/dev/null)
if [ "$output" = "- abc, staging, server, success" ]; then
  echo "ok   standard output fallback"
else
  echo "FAIL standard output fallback: '$output'"
  failures=$((failures + 1))
fi

[ "$failures" -eq 0 ] || exit 1
