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

pnpm prune --prod
# @sentry/node pulls in oxc-parser through @sentry/bundler-plugins. Only the bundler entry points
# (@sentry/node/bundler-plugin/*) load it, never the agent, and its platform binaries are native:
# left out of the artifact, as in pack-server.sh.
rm -rf node_modules/oxc-parser node_modules/@oxc-parser

staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
printf '%s\n' "$rev" >"$staging/nixpkgs-rev"

mkdir -p "$output"
archive="$output/delivery-$version.tar.gz"
tar -czf "$archive" \
  -C "$root" apps/delivery/dist apps/delivery/package.json package.json node_modules \
  -C "$staging" nixpkgs-rev
echo "$archive"
