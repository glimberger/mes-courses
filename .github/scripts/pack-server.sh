#!/bin/sh
# Usage: pack-server.sh <version> <commit> <sequence> [output folder]
# Builds server-<commit>.tar.gz from a built workspace (research R3): production dependencies
# only, no native addon, build-info.json next to the server's package.json.
# Run after `yarn build`. It modifies node_modules; run it on a CI checkout or a throwaway copy.
set -eu

if [ "$#" -lt 3 ]; then
  echo "usage: pack-server.sh <version> <commit> <sequence> [output folder]" >&2
  exit 1
fi
version=$1
commit=$2
sequence=$3
output=${4:-.}

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"

yarn workspaces focus --production @mes-courses/server
sh .github/scripts/server-native-check.sh node_modules

printf '{\n  "version": "%s",\n  "commit": "%s",\n  "sequence": %s\n}\n' \
  "$version" "$commit" "$sequence" >apps/server/build-info.json

mkdir -p "$output"
archive="$output/server-$commit.tar.gz"
tar -czf "$archive" \
  apps/server/dist apps/server/package.json apps/server/build-info.json \
  packages/sync-core/dist packages/sync-core/package.json \
  package.json node_modules
echo "$archive"
