#!/bin/sh
# Tests of delivery-targets.sh: one case per row of research R2.
# Usage: sh .github/scripts/delivery-targets.test.sh

dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
failures=0

check() {
  name=$1
  expected=$2
  actual=$(printf '%s' "$3" | sh "$dir/delivery-targets.sh" | tr '\n' ' ')
  if [ "$actual" = "$expected " ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: expected '$expected', got '$actual'"
    failures=$((failures + 1))
  fi
}

SERVER="server=true app=false"
APP="server=false app=true"
BOTH="server=true app=true"
NONE="server=false app=false"

check "server source" "$SERVER" "apps/server/src/x.ts
"
check "deploy files" "$SERVER" "deploy/Caddyfile
"
check "deploy/fdroid is app only" "$APP" "deploy/fdroid/staging/config.yml
"
check "mobile source" "$APP" "apps/mobile/src/x.ts
"
check "packages" "$BOTH" "packages/sync-core/src/x.ts
"
check "root package.json" "$BOTH" "package.json
"
check "yarn.lock" "$BOTH" "yarn.lock
"
check ".yarnrc.yml" "$BOTH" ".yarnrc.yml
"
check ".yarn folder" "$BOTH" ".yarn/releases/yarn.cjs
"
check "flake.nix" "$BOTH" "flake.nix
"
check "flake.lock" "$BOTH" "flake.lock
"
check "deliver-staging workflow" "$BOTH" ".github/workflows/deliver-staging.yml
"
check "delivery script" "$BOTH" ".github/scripts/delivery-targets.sh
"
check "delivery workspace" "$BOTH" "apps/delivery/src/domain/manifest.ts
"
check "docs" "$NONE" "README.md
"
check "specs" "$NONE" "specs/005-continuous-delivery/spec.md
"
check "tests folder" "$NONE" "tests/e2e/x.ts
"
check "other workflow" "$NONE" ".github/workflows/ci.yml
"
check "server and mobile" "$BOTH" "apps/server/src/a.ts
apps/mobile/src/b.ts
"
check "docs and server" "$SERVER" "README.md
apps/server/src/a.ts
"
check "no input builds nothing" "$NONE" ""

[ "$failures" -eq 0 ] || exit 1
