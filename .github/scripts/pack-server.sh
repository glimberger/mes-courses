#!/bin/sh
# Usage: pack-server.sh <version> <commit> <sequence> [output folder]
# Builds server-<commit>.tar.gz from a built workspace (research R3): production dependencies
# only, no native addon, build-info.json next to the server's package.json.
# Run after `pnpm build`. It writes build-info.json in apps/server; run it on a CI checkout or a
# throwaway copy.
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

# `pnpm deploy` writes the server and its production dependencies only (what `yarn workspaces focus
# --production` did): `pnpm prune --prod` would keep the production dependencies of every workspace,
# the mobile app's included. The result, node_modules with the workspace package injected, goes in
# the artifact under apps/server, where `node apps/server/dist/...` looks for it.
deployed=$(mktemp -d)
trap 'rm -rf "$deployed"' EXIT
pnpm --filter @mes-courses/server deploy --prod "$deployed/server"
# @sentry/node pulls in oxc-parser through @sentry/bundler-plugins. Only the bundler entry points
# (@sentry/node/bundler-plugin/*) load it, never the server, and its platform binaries are
# native: left out of the artifact, so the native check below stays strict for everything else.
rm -rf "$deployed"/server/node_modules/.pnpm/oxc-parser@* "$deployed"/server/node_modules/.pnpm/@oxc-parser+*
find "$deployed/server/node_modules" -type l ! -exec test -e {} \; -exec rm -f {} +
sh .github/scripts/server-native-check.sh "$deployed/server/node_modules"

printf '{\n  "version": "%s",\n  "commit": "%s",\n  "sequence": %s\n}\n' \
  "$version" "$commit" "$sequence" >apps/server/build-info.json

staging="$deployed/artifact"
mkdir -p "$staging/apps/server" "$output"
cp -R apps/server/dist apps/server/package.json apps/server/build-info.json "$staging/apps/server/"
mv "$deployed/server/node_modules" "$staging/apps/server/node_modules"
cp package.json "$staging/"
archive="$output/server-$commit.tar.gz"
tar -czf "$archive" -C "$staging" .
echo "$archive"
