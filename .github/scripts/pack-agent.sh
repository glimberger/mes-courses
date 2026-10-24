#!/bin/sh
# Usage: pack-agent.sh <version> [output folder]
# Builds delivery-<version>.tar.gz, the bundle of the agent that runs on the Pi (research R6):
# the built workspace, its production dependencies, and `nixpkgs-rev`, the revision to build the
# Node runtime from. <version> must be the delivery workspace's own version (what the manifests'
# `minAgentVersion` is compared to). Run after `pnpm build`. It modifies node_modules; run it on a
# CI checkout or a throwaway copy.
set -eu

if [ "$#" -lt 1 ]; then
  echo "usage: pack-agent.sh <version> [output folder]" >&2
  exit 1
fi
version=$1
output=${2:-.}

case "$version" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *)
    echo "the version must look like X.Y.Z, got '$version'" >&2
    exit 1
    ;;
esac
case "$version" in
  *[!0-9.]*)
    echo "the version must look like X.Y.Z, got '$version'" >&2
    exit 1
    ;;
esac

root=${PACK_AGENT_ROOT:-$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)}
cd "$root"

actual=$(sed -n 's/^  "version": "\(.*\)",$/\1/p' apps/delivery/package.json | head -1)
if [ "$actual" != "$version" ]; then
  echo "apps/delivery is at version '$actual', not '$version'" >&2
  exit 1
fi
if [ ! -f apps/delivery/dist/composition/main.js ]; then
  echo "apps/delivery/dist/composition/main.js does not exist: run pnpm build first" >&2
  exit 1
fi

rev=$(jq -r '.nodes.nixpkgs.locked.rev // empty' flake.lock)
case "$rev" in
  *[!0-9a-f]* | "")
    echo "no nixpkgs revision found in flake.lock" >&2
    exit 1
    ;;
esac

# `pnpm deploy` writes the delivery workspace and its production dependencies only (what `yarn
# workspaces focus --production` did): `pnpm prune --prod` would keep those of every workspace. The
# result goes in the bundle under apps/delivery, where `node apps/delivery/dist/...` looks for it.
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
pnpm --filter @mes-courses/delivery deploy --prod "$staging/delivery"
# @sentry/node pulls in oxc-parser through @sentry/bundler-plugins. Only the bundler entry points
# (@sentry/node/bundler-plugin/*) load it, never the agent, and its platform binaries are native:
# left out of the artifact, as in pack-server.sh.
rm -rf "$staging"/delivery/node_modules/.pnpm/oxc-parser@* "$staging"/delivery/node_modules/.pnpm/@oxc-parser+*
find "$staging/delivery/node_modules" -type l ! -exec test -e {} \; -exec rm -f {} +

printf '%s\n' "$rev" >"$staging/nixpkgs-rev"
mkdir -p "$staging/bundle/apps/delivery" "$output"
cp -R "$root/apps/delivery/dist" "$root/apps/delivery/package.json" "$staging/bundle/apps/delivery/"
mv "$staging/delivery/node_modules" "$staging/bundle/apps/delivery/node_modules"
cp "$root/package.json" "$staging/bundle/"
mv "$staging/nixpkgs-rev" "$staging/bundle/"

archive="$output/delivery-$version.tar.gz"
tar -czf "$archive" -C "$staging/bundle" .
echo "$archive"
