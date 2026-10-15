#!/bin/sh
# Usage: server-native-check.sh <node_modules dir>
# Fails when the folder holds a native addon (.node file or binding.gyp): the server artifact is
# built on x86_64 and must run unchanged on the Pi's aarch64 (research R3, R14).

folder=${1:-}
if [ -z "$folder" ] || [ ! -d "$folder" ]; then
  echo "usage: server-native-check.sh <node_modules dir>" >&2
  exit 1
fi

found=$(find "$folder" \( -name '*.node' -o -name 'binding.gyp' \) -print)
if [ -n "$found" ]; then
  echo "Native code found in the server dependencies:" >&2
  echo "$found" >&2
  exit 1
fi
