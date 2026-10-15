#!/bin/sh
# Appends one line to the run summary: commit, environment, target, outcome (FR-030).
# Usage: SHA=<commit> DELIVERY_ENVIRONMENT=<staging|production> delivery-summary.sh <target> <outcome> [url]
set -eu

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "usage: delivery-summary.sh <target> <outcome> [url]" >&2
  exit 2
fi
target=$1
outcome=$2
url=${3:-}

: "${SHA:?SHA is not set}"
case "${DELIVERY_ENVIRONMENT:-}" in
  staging | production) ;;
  *)
    echo "DELIVERY_ENVIRONMENT must be staging or production" >&2
    exit 2
    ;;
esac
case "$outcome" in
  success | failure | skipped | cancelled) ;;
  *)
    echo "unknown outcome: $outcome" >&2
    exit 2
    ;;
esac

line="- $SHA, $DELIVERY_ENVIRONMENT, $target, $outcome"
[ -z "$url" ] || line="$line ($url)"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "$line" >>"$GITHUB_STEP_SUMMARY"
else
  echo "$line"
fi
