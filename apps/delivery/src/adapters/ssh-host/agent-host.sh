#!/bin/sh
# The Pi side of `pnpm agent:update`. It is not installed anywhere: the Mac sends it over the
# standard input of `ssh <host> sudo -n sh -s -- <operation> [arguments]`, so it runs as root and
# the repository does not have to be checked out on the Pi.
#
#   current                       print the version `current` points at (nothing when none)
#   ready <version>               exit 0 when releases/<version> is completely installed, 10 if not
#   install <version> <asset id>  download the bundle and unpack it into releases/<version>
#   build <version>               build the Node runtime of that release, then mark it ready
#   activate <version>            point `runtime` and `current` at that ready release
#   status                        run `main.js status` with the agent's environment
#
# The GitHub token is read here from the agent's env file and is only ever a shell variable
# (never exported, never an argument): curl takes its header from a pipe.
#
# The whole script is one function called on the last line: `sh -s` reads the script from the
# same stream a command could read, so nothing is left to be consumed after the call.
set -eu

main() {
  root=${AGENT_ROOT:-/opt/mes-courses/agent}
  env_file=${AGENT_ENV_FILE:-/etc/mes-courses/agent.env}
  api=${AGENT_GITHUB_API:-https://api.github.com}
  PATH="$PATH:/nix/var/nix/profiles/default/bin"

  die() {
    echo "$*" >&2
    exit 1
  }

  version_arg() {
    case "$1" in
      "" | *[!0-9.]* | .* | *.) die "invalid version: '$1'" ;;
    esac
  }

  current_version() {
    if [ -L "$root/current" ]; then
      basename "$(readlink "$root/current")"
    fi
  }

  # A release is ready once the build finished and marked it, or when it is the one `current`
  # already points at and is not half-installed (an install made by hand, before this command).
  is_ready() {
    dir="$root/releases/$1"
    [ -f "$dir/apps/delivery/dist/composition/main.js" ] || return 1
    [ ! -e "$dir/.installing" ] || return 1
    [ -e "$dir/.ready" ] || [ "$(current_version)" = "$1" ]
  }

  op=${1:-}
  [ -n "$op" ] || die "missing operation"
  shift

  case "$op" in
    current)
      current_version
      ;;
    ready)
      version_arg "${1:-}"
      is_ready "$1" || exit 10
      ;;
    install)
      version_arg "${1:-}"
      version=$1
      asset_id=${2:-}
      case "$asset_id" in
        "" | *[!0-9]*) die "invalid asset id: '$asset_id'" ;;
      esac
      dir="$root/releases/$version"
      # An earlier attempt that did not finish is not an install: start again from nothing. The
      # release `current` points at is never touched.
      if [ "$(current_version)" = "$version" ]; then
        die "current already points at releases/$version: not replacing it in place"
      fi
      mkdir -p "$root/releases"
      rm -rf "$dir"
      mkdir "$dir"
      touch "$dir/.installing"
      tmp=$(mktemp -d "$root/.download.XXXXXX")
      trap 'rm -rf "$tmp"' EXIT
      (
        # shellcheck disable=SC1090 # the env file lives on the Pi
        . "$env_file"
        : "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set in $env_file}"
        : "${GITHUB_TOKEN:?GITHUB_TOKEN is not set in $env_file}"
        printf 'Authorization: Bearer %s\n' "$GITHUB_TOKEN" |
          curl --fail --silent --show-error --location \
            --header @- \
            --header 'Accept: application/octet-stream' \
            --header 'X-GitHub-Api-Version: 2022-11-28' \
            --output "$tmp/bundle.tar.gz" \
            "$api/repos/$GITHUB_REPOSITORY/releases/assets/$asset_id"
      ) || die "the download of the bundle failed"
      tar -xzf "$tmp/bundle.tar.gz" -C "$dir" || die "the bundle could not be unpacked"
      [ -f "$dir/apps/delivery/dist/composition/main.js" ] || die "the bundle holds no main.js"
      [ -s "$dir/nixpkgs-rev" ] || die "the bundle holds no nixpkgs-rev"
      ;;
    build)
      version_arg "${1:-}"
      dir="$root/releases/$1"
      [ -e "$dir/.installing" ] || die "releases/$1 is not freshly unpacked"
      rev=$(tr -d '[:space:]' <"$dir/nixpkgs-rev")
      case "$rev" in
        "" | *[!0-9a-f]*) die "nixpkgs-rev is not a commit hash" ;;
      esac
      rm -f "$dir/runtime"
      nix build "github:NixOS/nixpkgs/$rev#nodejs_24" --out-link "$dir/runtime"
      [ -x "$dir/runtime/bin/node" ] || die "the runtime has no bin/node"
      touch "$dir/.ready"
      rm -f "$dir/.installing"
      ;;
    activate)
      version_arg "${1:-}"
      dir="$root/releases/$1"
      [ -e "$dir/.ready" ] && [ ! -e "$dir/.installing" ] || die "releases/$1 is not ready"
      if [ -e "$root/runtime" ] && [ ! -L "$root/runtime" ]; then
        die "$root/runtime is not a link"
      fi
      if [ -e "$root/current" ] && [ ! -L "$root/current" ]; then
        die "$root/current is not a link"
      fi
      previous_runtime=$(readlink "$root/runtime" || true)
      # Two renames, each atomic: the runtime first (any release runs on any runtime built by
      # this command), then current. If the second fails the first is put back.
      ln -sfn "$dir/runtime" "$root/.runtime.new"
      mv -T "$root/.runtime.new" "$root/runtime"
      ln -sfn "$dir" "$root/.current.new"
      if ! mv -T "$root/.current.new" "$root/current"; then
        if [ -n "$previous_runtime" ]; then
          ln -sfn "$previous_runtime" "$root/.runtime.new"
          mv -T "$root/.runtime.new" "$root/runtime"
        fi
        die "could not repoint current"
      fi
      ;;
    status)
      (
        set -a
        # shellcheck disable=SC1090 # the env file lives on the Pi
        . "$env_file"
        set +a
        exec "$root/runtime/bin/node" \
          "$root/current/apps/delivery/dist/composition/main.js" status
      )
      ;;
    *)
      die "unknown operation: $op"
      ;;
  esac
}

main "$@"; exit
