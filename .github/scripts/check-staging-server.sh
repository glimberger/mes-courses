#!/bin/sh
# Usage: check-staging-server.sh <archive> <expected sha256>
# The checksum gate of the production release (ADR-0015): the server archive taken from staging
# must be byte-identical to the one the staging manifest describes. It fails, naming both
# checksums, before anything is published. There is no fallback build.
set -eu

if [ "$#" -ne 2 ]; then
  echo "usage: check-staging-server.sh <archive> <expected sha256>" >&2
  exit 2
fi
archive=$1
expected=$2

case "$expected" in
  *[!0-9a-f]* | '')
    echo "check-staging-server.sh: the expected checksum must be 64 lowercase hex characters, got '$expected'" >&2
    exit 2
    ;;
esac
if [ "${#expected}" -ne 64 ]; then
  echo "check-staging-server.sh: the expected checksum must be 64 lowercase hex characters, got '$expected'" >&2
  exit 2
fi
if [ ! -f "$archive" ]; then
  echo "The staging server archive $archive is missing: the release cannot reuse it and does not rebuild the server" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$archive" | cut -d ' ' -f 1)
else
  actual=$(shasum -a 256 "$archive" | cut -d ' ' -f 1)
fi
if [ "$actual" != "$expected" ]; then
  echo "The staging server archive does not match the staging manifest: checksum $actual, expected $expected. The release is stopped before anything is published." >&2
  exit 1
fi
echo "The server archive is byte-identical to the one staging delivered ($actual)"
