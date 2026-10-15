#!/bin/sh
# Tests of the argument, precondition and unit checks of pack-agent.sh. The first cases fail before
# `yarn` runs. The quoted-path case passes the checks and stops at a stub `yarn`; the last two run
# the stub too, and the pruned path fails in the archive check.
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failures=0

mkdir -p "$work/apps/delivery"
printf '{\n  "name": "@mes-courses/delivery",\n  "version": "1.0.0",\n}\n' >"$work/apps/delivery/package.json"

expect_failure() {
  name=$1
  expected=$2
  shift 2
  message=$(env PACK_AGENT_ROOT="$work" "$@" 2>&1 >/dev/null)
  status=$?
  case "$message" in
    *"$expected"*) [ "$status" -ne 0 ] && echo "ok   $name" && return ;;
  esac
  echo "FAIL $name: status $status, message '$message'"
  failures=$((failures + 1))
}

expect_failure "no arguments" "usage" sh "$dir/pack-agent.sh"
expect_failure "not a version" "X.Y.Z" sh "$dir/pack-agent.sh" latest
expect_failure "path in the version" "X.Y.Z" sh "$dir/pack-agent.sh" 1.0.0/../x
expect_failure "version differs from the workspace" "not '1.2.0'" sh "$dir/pack-agent.sh" 1.2.0
expect_failure "nothing built" "yarn build" sh "$dir/pack-agent.sh" 1.0.0

# The build produces dist/composition/main.js. The unit must start only files the build produces.
mkdir -p "$work/apps/delivery/dist/composition" "$work/deploy"
: >"$work/apps/delivery/dist/composition/main.js"
unit="$work/deploy/mes-courses-agent.service"
node=/opt/mes-courses/agent/runtime/bin/node
bundle=/opt/mes-courses/agent/current

printf '[Service]\nExecStart=%s %s/apps/delivery/dist/main.js run\n' "$node" "$bundle" >"$unit"
expect_failure "unit starts a file the build does not produce" "does not produce" sh "$dir/pack-agent.sh" 1.0.0

printf '[Service]\nExecStart=%s %s/apps/delivery/dist/composition/main.js run\nExecStart=%s %s/apps/delivery/dist/main.js run\n' \
  "$node" "$bundle" "$node" "$bundle" >"$unit"
expect_failure "second ExecStart starts a file the build does not produce" "does not produce" sh "$dir/pack-agent.sh" 1.0.0

printf '[Service]\nExecStart=%s %s/apps/delivery/dist/composition/main.js --cfg %s/apps/delivery/dist/missing.json run\n' \
  "$node" "$bundle" "$bundle" >"$unit"
expect_failure "a later path on the same ExecStart line is checked" "does not produce" sh "$dir/pack-agent.sh" 1.0.0

printf '[Service]\nExecStart=%s %s/apps/delivery/dist/composition/*.js run\n' "$node" "$bundle" >"$unit"
expect_failure "a glob is not taken as a file of the build" "does not produce" sh "$dir/pack-agent.sh" 1.0.0

printf '[Service]\nExecStart=%s %s/apps/delivery/dist/composition run\n' "$node" "$bundle" >"$unit"
expect_failure "a directory is not an executable of the build" "does not produce" sh "$dir/pack-agent.sh" 1.0.0

printf '[Service]\nExecStartPre=/bin/true %s/apps/delivery/dist/gone.js\nExecStart=%s %s/apps/delivery/dist/composition/main.js run\n' \
  "$bundle" "$node" "$bundle" >"$unit"
expect_failure "ExecStartPre is checked too" "does not produce" sh "$dir/pack-agent.sh" 1.0.0

# A stub yarn stands for the production install: it prunes node_modules/pruned, then exits with
# STUB_YARN_STATUS (1 by default, which stops the script at yarn: reaching it means the checks passed).
echo '{"nodes":{"nixpkgs":{"locked":{"rev":"0123abcd"}}}}' >"$work/flake.lock"
mkdir -p "$work/bin"
cat >"$work/bin/yarn" <<'EOF'
#!/bin/sh
echo "reached yarn" >&2
rm -rf node_modules/pruned
exit "${STUB_YARN_STATUS:-1}"
EOF
chmod +x "$work/bin/yarn"
# A comment may name a missing path, and WorkingDirectory= may name a directory of the build.
printf '[Service]\n# Old entry: %s/apps/delivery/dist/gone.js\nWorkingDirectory=%s/apps/delivery\nExecStart=%s "%s/apps/delivery/dist/composition/main.js" run\n' \
  "$bundle" "$bundle" "$node" "$bundle" >"$unit"
expect_failure "comments and directories of the build pass the checks" "reached yarn" PATH="$work/bin:$PATH" sh "$dir/pack-agent.sh" 1.0.0

printf '[Service]\nWorkingDirectory=%s/\n' "$bundle" >"$unit"
expect_failure "a bare bundle root names no path" "names no path under" sh "$dir/pack-agent.sh" 1.0.0

# The prune removes node_modules/pruned, which the unit names: the archive check must catch it.
mkdir -p "$work/node_modules/pruned" "$work/node_modules/kept"
echo x >"$work/node_modules/pruned/index.js"
echo x >"$work/node_modules/kept/index.js"
echo '{}' >"$work/package.json"
printf '[Service]\nExecStart=%s %s/node_modules/pruned/index.js run\n' "$node" "$bundle" >"$unit"
expect_failure "a path pruned before packing is caught in the archive" "not in the archive" \
  STUB_YARN_STATUS=0 PATH="$work/bin:$PATH" sh "$dir/pack-agent.sh" 1.0.0

# A passing run prints the archive path and leaves the archive in place.
printf '[Service]\nExecStart=%s "%s/node_modules/kept/index.js" run\n' "$node" "$bundle" >"$unit"
out=$(env PACK_AGENT_ROOT="$work" STUB_YARN_STATUS=0 PATH="$work/bin:$PATH" sh "$dir/pack-agent.sh" 1.0.0 2>/dev/null) || out=""
if [ "$out" = "./delivery-1.0.0.tar.gz" ] && [ -f "$work/delivery-1.0.0.tar.gz" ]; then
  echo "ok   a passing run prints the archive path"
else
  echo "FAIL a passing run prints the archive path: '$out'"
  failures=$((failures + 1))
fi

[ "$failures" -eq 0 ] || exit 1
