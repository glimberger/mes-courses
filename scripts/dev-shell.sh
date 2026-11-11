#!/usr/bin/env bash
# Run a command with the tools of the project's Nix dev shell (flake.nix) on PATH.
#
# Usage: scripts/dev-shell.sh <command> [args...]
#
# The Git hooks (lefthook.yml) go through this wrapper, so they work whatever shell runs
# `git push` or `git commit`: an agent outside a direnv terminal, a worktree that was never
# `direnv allow`ed, a GUI Git client. When the dev shell is already loaded (direnv, `nix develop`)
# the command runs as is, with no extra cost.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: ${0##*/} <command> [args...]" >&2
  exit 2
fi

# The dev shell is loaded when a Nix shell is active (direnv, `nix develop` set IN_NIX_SHELL) and
# the tools the hooks need are on PATH. Tools alone are not enough: a global pnpm or git-cliff
# (Homebrew, say) would hide a missing flake Node.
if [ -n "${IN_NIX_SHELL:-}" ] && command -v git-cliff >/dev/null 2>&1 && command -v pnpm >/dev/null 2>&1; then
  exec "$@"
fi

if ! command -v nix >/dev/null 2>&1; then
  echo "${0##*/}: the Nix dev shell tools are missing and nix is not on PATH." >&2
  echo "Install Nix (see README.md) or run this from \`nix develop\`." >&2
  exit 1
fi

exec nix develop "$(git rev-parse --show-toplevel)" --command "$@"
