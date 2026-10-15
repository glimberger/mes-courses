#!/bin/sh
# Usage: repo-address.sh <staging|production> [--no-qr]
# Prints the address of an environment's F-Droid repository with the fingerprint of its key, then
# its QR code when `qrencode` is installed (quickstart section 6). The F-Droid client pins the key
# from the fingerprint, so never share the address without it.
# Environment: SERVER_URL (the environment's public address, https), FDROID_FINGERPRINT (SHA-256 of
# the repository key, with or without colons; `keytool -list -keystore <jks>` prints it).
set -eu

if [ "$#" -lt 1 ]; then
  echo "usage: repo-address.sh <staging|production> [--no-qr]" >&2
  exit 1
fi
variant=$1
qr=${2:-}

case "$variant" in
  staging | production) ;;
  *)
    echo "repo-address: the environment must be staging or production, got '$variant'" >&2
    exit 1
    ;;
esac
for name in SERVER_URL FDROID_FINGERPRINT; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "repo-address: $name is not set" >&2
    exit 1
  fi
done
case "$SERVER_URL" in
  https://*) ;;
  *)
    echo "repo-address: SERVER_URL must start with https://" >&2
    exit 1
    ;;
esac

fingerprint=$(printf '%s' "$FDROID_FINGERPRINT" | tr -d ':' | tr 'A-F' 'a-f')
case "$fingerprint" in
  *[!0-9a-f]* | '')
    echo "repo-address: FDROID_FINGERPRINT must be 64 hexadecimal characters" >&2
    exit 1
    ;;
esac
if [ "${#fingerprint}" -ne 64 ]; then
  echo "repo-address: FDROID_FINGERPRINT must be 64 hexadecimal characters" >&2
  exit 1
fi

address="${SERVER_URL%/}/fdroid/repo?fingerprint=$fingerprint"
echo "$address"
if [ "$qr" != "--no-qr" ] && command -v qrencode >/dev/null 2>&1; then
  qrencode -t ansiutf8 "$address"
fi
