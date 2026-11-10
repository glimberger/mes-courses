#!/bin/sh
# Usage: pack-server.sh <commit> [output folder]
# Builds server-<commit>.tar.gz from a built workspace (research R3): production dependencies
# only, no native addon. Run it after `pnpm build`.
#
# Nothing environment-specific goes in the archive (ADR-0015): staging delivers it and production
# promotes the same bytes. In particular there is no build-info.json (version, commit, sequence):
# the agent writes it on the Pi from the manifest entry it installs. The environment itself
# (port, data folder, Sentry environment) comes from the systemd unit at run time.
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: pack-server.sh <commit> [output folder]" >&2
  exit 1
fi
commit=$1
output=${2:-.}
case "$commit" in
  *[!0-9a-f]* | '')
    echo "pack-server.sh: the commit must be 40 lowercase hex characters, got '$commit'" >&2
    exit 1
    ;;
esac
if [ "${#commit}" -ne 40 ]; then
  echo "pack-server.sh: the commit must be 40 lowercase hex characters, got '$commit'" >&2
  exit 1
fi

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

staging="$deployed/artifact"
mkdir -p "$staging/apps/server" "$output"
cp -R apps/server/dist apps/server/package.json "$staging/apps/server/"
mv "$deployed/server/node_modules" "$staging/apps/server/node_modules"
cp package.json "$staging/"
archive="$output/server-$commit.tar.gz"
tar -czf "$archive" -C "$staging" .
echo "$archive"
