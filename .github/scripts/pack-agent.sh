#!/bin/sh
# Usage: pack-agent.sh <version> [output folder]
# Builds delivery-<version>.tar.gz, the bundle of the agent that runs on the Pi (research R6):
# the built workspace, its production dependencies, and `nixpkgs-rev`, the revision to build the
# Node runtime from. <version> must be the delivery workspace's own version (what the manifests'
# `minAgentVersion` is compared to). Run after `yarn build`. It modifies node_modules; run it on a
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
if [ ! -d apps/delivery/dist ]; then
  echo "apps/delivery/dist does not exist: run yarn build first" >&2
  exit 1
fi
# The agent unit names paths of the bundle, from its root. The executables of Exec* lines must be
# files; the other lines (WorkingDirectory=...) may name directories. Comment lines are skipped.
# Each path must be built before packing, and must still be in the archive after the production
# prune. Otherwise the Pi fails with status 203, or runs a file that is not there.
unit=deploy/mes-courses-agent.service
bundle=/opt/mes-courses/agent/current/
if [ ! -f "$unit" ]; then
  echo "$unit does not exist" >&2
  exit 1
fi
uncommented=$(grep -vE '^[[:space:]]*[#;]' "$unit" || true)
execs=$(printf '%s\n' "$uncommented" | grep -E '^[[:space:]]*Exec[A-Za-z]*=' |
  grep -oE "$bundle[^[:space:]\"']+" | sed "s|^$bundle||" || true)
others=$(printf '%s\n' "$uncommented" | grep -vE '^[[:space:]]*Exec[A-Za-z]*=' |
  grep -oE "$bundle[^[:space:]\"']+" | sed "s|^$bundle||" || true)
paths=$(printf '%s\n%s\n' "$execs" "$others" | sed '/^$/d')
if [ -z "$paths" ]; then
  echo "$unit names no path under $bundle" >&2
  exit 1
fi
check_built() {
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    if [ ! "$1" "$path" ]; then
      echo "$unit names '$path', which the build does not produce" >&2
      exit 1
    fi
  done <<EOF
$2
EOF
}
check_built -f "$execs"
check_built -e "$others"

rev=$(jq -r '.nodes.nixpkgs.locked.rev // empty' flake.lock)
case "$rev" in
  *[!0-9a-f]* | "")
    echo "no nixpkgs revision found in flake.lock" >&2
    exit 1
    ;;
esac

yarn workspaces focus --production @mes-courses/delivery
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

# The prune above may have removed a path the unit names: check the archive itself.
listing=$(tar -tzf "$archive")
while IFS= read -r path; do
  # tar does not list the parents of a directory, so a directory is found by one entry under it.
  if ! printf '%s\n' "$listing" | awk -v p="$path" '$0 == p || index($0, p "/") == 1 { f = 1 } END { exit !f }'; then
    rm -f "$archive"
    echo "$unit names '$path', which is not in the archive" >&2
    exit 1
  fi
done <<EOF
$paths
EOF
echo "$archive"
