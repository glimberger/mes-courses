#!/bin/sh
# Starts the compiled server the way the Pi does (node --conditions=production
# dist/composition/main.js), checks /v1/health, then signs in an administrator created with the compiled
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

# The password is read twice from a pipe, one line at a time.
password="smoke test password"
(printf '%s\n' "$password"; sleep 1; printf '%s\n' "$password") |
  MES_COURSES_DB="$dir/db" node --conditions=production \
    apps/server/dist/composition/create-admin.js admin@example.org

response=$(curl -sf -X POST "http://127.0.0.1:$port/v1/auth/sign-in" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin@example.org\",\"password\":\"$password\",\"deviceName\":\"smoke\"}")
case "$response" in
  *'"outcome":"signedIn"'*) echo "server-smoke: signed in" ;;
  *)
    echo "server-smoke: sign-in failed" >&2
    exit 1
    ;;
esac
