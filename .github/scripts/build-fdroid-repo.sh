#!/bin/sh
# Usage: build-fdroid-repo.sh <staging|production> <apk> <sha> [output folder]
# Builds the F-Droid repository of an environment from deploy/fdroid/<variant>/ and the signed
# APK, and archives its repo/ folder as <output>/fdroid-<variant>-<sha>.tar.gz (research R12).
# Environment: SERVER_URL (the environment's public address), FDROID_KEYSTORE_BASE64,
# FDROID_KEYSTORE_PASSWORD, FDROID_KEY_PASSWORD. Needs `fdroid` (nix shell nixpkgs#fdroidserver).
set -eu

if [ "$#" -lt 3 ]; then
  echo "usage: build-fdroid-repo.sh <staging|production> <apk> <sha> [output folder]" >&2
  exit 1
fi
variant=$1
apk=$2
sha=$3
output=${4:-.}

case "$variant" in
  staging | production) ;;
  *)
    echo "build-fdroid-repo: the variant must be staging or production, got '$variant'" >&2
    exit 1
    ;;
esac
if [ ! -f "$apk" ]; then
  echo "build-fdroid-repo: $apk does not exist" >&2
  exit 1
fi
case "$sha" in
  *[!0-9a-f]* | '')
    echo "build-fdroid-repo: the sha must be lowercase hexadecimal" >&2
    exit 1
    ;;
esac
for name in SERVER_URL FDROID_KEYSTORE_BASE64 FDROID_KEYSTORE_PASSWORD FDROID_KEY_PASSWORD; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "build-fdroid-repo: $name is not set" >&2
    exit 1
  fi
done

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

cp -R "$root/deploy/fdroid/$variant/." "$work/"
mkdir -p "$work/repo"
cp "$apk" "$work/repo/"
repo_url="${SERVER_URL%/}/fdroid/repo"
sed "s|__REPO_URL__|$repo_url|" "$work/config.yml" >"$work/config.yml.new"
mv "$work/config.yml.new" "$work/config.yml"
(umask 077 && printf '%s' "$FDROID_KEYSTORE_BASE64" | base64 -d >"$work/keystore.jks")
chmod 600 "$work/config.yml"

(cd "$work" && fdroid update --create-metadata --verbose)

mkdir -p "$output"
archive="$output/fdroid-$variant-$sha.tar.gz"
tar -czf "$archive" -C "$work" repo
echo "$archive"
