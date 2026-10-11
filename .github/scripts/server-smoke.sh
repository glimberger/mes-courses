#!/bin/sh
# Starts the compiled server the way the Pi does (node --conditions=production
# dist/composition/main.js), checks /v1/health, then creates a pairing code with the compiled
# script. Run after `yarn build`. Catches a dist/ that only works under tsx or Jest.
set -eu

dir=$(mktemp -d)
port=3917
trap 'kill "$pid" 2>/dev/null || true; rm -rf "$dir"' EXIT

MES_COURSES_DB="$dir/db" MES_COURSES_PORT=$port \
  node --conditions=production apps/server/dist/composition/main.js &
pid=$!

i=0
until curl -sf "http://127.0.0.1:$port/v1/health"; do
  i=$((i + 1))
  if [ "$i" -ge 20 ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "server-smoke: the compiled server did not answer /v1/health" >&2
    exit 1
  fi
  sleep 0.5
done
echo

MES_COURSES_DB="$dir/db" node --conditions=production apps/server/dist/composition/pairing-code.js
