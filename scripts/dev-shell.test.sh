#!/bin/sh
# Tests of dev-shell.sh, with stub tools on a fake PATH (no real Nix needed).
dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
script="$dir/dev-shell.sh"
failures=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

stub() {
  printf '#!/bin/sh\n%s\n' "$2" >"$tmp/bin/$1"
  chmod +x "$tmp/bin/$1"
}
fresh_bin() {
  rm -rf "${tmp:?}/bin"
  mkdir "$tmp/bin"
  stub git 'echo /fake/toplevel'
}

# check <name> <expected status> <expected output fragment> <command...>
check() {
  name=$1
  want_status=$2
  want_text=$3
  shift 3
  output=$("$@" 2>&1)
  status=$?
  case "$output" in
    *"$want_text"*) [ "$status" -eq "$want_status" ] && echo "ok   $name" && return ;;
  esac
  echo "FAIL $name: status $status, output '$output'"
  failures=$((failures + 1))
}

run() { env -i PATH="$tmp/bin:/usr/bin:/bin" "$@"; }

fresh_bin
check "no command: usage error" 2 "usage:" run bash "$script"

stub git-cliff 'exit 0'
stub pnpm 'exit 0'
check "tools without a Nix shell: enters nix, missing nix is an error" 1 "nix is not on PATH" run bash "$script" echo hi

stub nix 'echo "nix $*"'
check "tools without a Nix shell: enters the dev shell" 0 "nix develop /fake/toplevel --command echo hi" run bash "$script" echo hi
check "Nix shell loaded: runs the command directly" 0 "hi" run IN_NIX_SHELL=impure bash "$script" echo hi

rm "$tmp/bin/git-cliff"
check "Nix shell without git-cliff: enters the dev shell" 0 "nix develop" run IN_NIX_SHELL=impure bash "$script" echo hi

[ "$failures" -eq 0 ]
