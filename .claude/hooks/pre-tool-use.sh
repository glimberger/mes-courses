#!/usr/bin/env bash
# PreToolUse hook: blocks, before it runs, a tool call that breaks the repository rules.
#
# File edits (Edit, Write, MultiEdit, NotebookEdit) in this repository, or one of its worktrees:
# - never on the default branch, nor on a detached HEAD;
# - never on a guardrail file (see is_protected in lib.sh);
# - on a Spec Kit feature branch whose feature folder holds an agent-scope.txt, only inside that
#   folder or a path the scope file lists.
#
# Bash commands: no skipping the Git hooks, no force push, no push to the default branch, no commit on
# it, no PR merge, and no write to a guardrail file.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
guardrails_off && exit 0
require_jq

input=$(cat)
tool=$(jq -r '.tool_name' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
project_dir=${CLAUDE_PROJECT_DIR:-$cwd}
project_common=$(git_common_dir "$project_dir")
[ -n "$project_common" ] || exit 0

check_file() {
  local file=$1 dir top rel branch default feature_dir scope number pattern
  case "$file" in /*) ;; *) file="$cwd/$file" ;; esac
  dir=$(existing_dir "$file")
  # A ".." in the part of the path that does not exist yet would not be normalised below.
  case "${file#"$dir"}" in
    */../* | */.. | ../*) block "$file contains '..' after a folder that does not exist yet: use a normalised path." ;;
  esac
  # Resolve symbolic links (/tmp is /private/tmp on macOS), as git rev-parse does.
  file="$(cd "$dir" && pwd -P)${file#"$dir"}"
  dir=$(existing_dir "$file")
  # The Git directory holds the hooks and the config: an edit there would switch them off.
  case "$file" in
    "$project_common" | "$project_common"/* | */.git | */.git/*)
      block "$file is inside a .git directory. Only the user edits it."
      ;;
  esac
  # Files outside this repository are left to Claude Code's own permissions.
  [ "$(git_common_dir "$dir")" = "$project_common" ] || return 0
  top=$(git -C "$dir" rev-parse --show-toplevel)
  rel=${file#"$top"/}

  if is_protected "$rel"; then
    block "$rel is a guardrail file. Only the user edits it: propose the change instead."
  fi

  branch=$(git -C "$top" branch --show-current)
  default=$(default_branch "$top")
  if [ -z "$branch" ] || [ "$branch" = "$default" ]; then
    block "the working tree at $top is on '${branch:-detached HEAD}'. Create a branch from origin/$default first (see AGENTS.md)."
  fi

  # Scope of the current Spec Kit feature, found from the branch name alone (specs/003-server-sync
  # matches a branch named like feat/003-...), so that no editable file can switch it off.
  for scope in "$top"/specs/*/agent-scope.txt; do
    [ -f "$scope" ] || continue
    feature_dir=${scope#"$top"/}
    feature_dir=${feature_dir%/agent-scope.txt}
    number=${feature_dir##*/}
    number=${number%%-*}
    [[ "$branch" =~ (^|/)$number- ]] || continue
    [[ "$rel" == "$feature_dir"/* ]] && return 0
    while IFS= read -r pattern || [ -n "$pattern" ]; do
      pattern=${pattern%%#*}
      pattern=$(printf '%s' "$pattern" | sed 's/[[:space:]]*$//; s/^[[:space:]]*//')
      [ -n "$pattern" ] || continue
      # Unquoted on purpose: the pattern is a glob, where * also matches /.
      # shellcheck disable=SC2053
      [[ "$rel" == $pattern ]] && return 0
    done <"$scope"
    block "$rel is outside the scope of $feature_dir (see $feature_dir/agent-scope.txt). Ask the user to widen the scope, or leave the file alone."
  done
  return 0
}

check_bash() {
  local cmd=$1 workdir dest branch default git push mutators cp_targets bash_protected
  # Where the command runs: a "cd <dir>" or "git -C <dir>" in it wins over the session directory.
  workdir=$cwd
  dest=$(grep -Eo -- '(^|[;&|[:space:]])(cd|git[[:space:]]+-C)[[:space:]]+[^[:space:];&|]+' <<<"$cmd" | tail -n 1 | awk '{print $NF}' | tr -d "\"'")
  if [ -n "$dest" ]; then
    case "$dest" in
      "~"*) dest="$HOME${dest#"~"}" ;;
      /*) ;;
      *) dest="$workdir/$dest" ;;
    esac
    [ -d "$dest" ] && workdir=$dest
  fi
  branch=$(git -C "$workdir" branch --show-current 2>/dev/null)
  default=$(default_branch "$workdir")
  # "git", optionally followed by -C <dir> or -c <key=value>.
  git='git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+'

  if grep -Eiq -- '--no-verify|(LEFTHOOK|HUSKY)=["'"'"']?(0|false)["'"'"']?([^[:alnum:]_]|$)|LEFTHOOK_EXCLUDE=|core\.hooksPath' <<<"$cmd"; then
    block "Git hooks must always run: fix what the hook reports instead. (If these words only appear in a message, reword it.)"
  fi
  # -n, possibly inside a cluster of short flags (-an, -nm).
  if grep -Eq -- "${git}commit([^|;&]*[[:space:]])?-[a-zA-Z]*n[a-zA-Z]*([[:space:]]|\$)" <<<"$cmd"; then
    block "git commit -n skips the Git hooks: fix what the hook reports instead."
  fi
  # Only the git push segment is checked, so that "git push ... && git log main" passes.
  push=$(grep -Eo -- "${git}push[^|;&]*" <<<"$cmd" || true)
  if [ -n "$push" ]; then
    if grep -Eq -- '[[:space:]](--force|-[a-zA-Z]*f[a-zA-Z]*)([[:space:]]|=|$)|[[:space:]]\+[^[:space:]]+' <<<"$push"; then
      block "force push is not allowed. Use --force-with-lease on your own feature branch."
    fi
    if grep -Eq -- '[[:space:]]--(all|mirror)([[:space:]]|$)' <<<"$push"; then
      block "git push --all and --mirror would push $default as well: name the branch to push."
    fi
    if [ "$branch" = "$default" ] || grep -Eq "([[:space:]]|:|refs/heads/)$default([[:space:]]|\$)" <<<"$push"; then
      block "never push to $default (or from it): open a pull request from a feature branch."
    fi
  fi
  if [ "$branch" = "$default" ] && grep -Eq -- "${git}commit" <<<"$cmd"; then
    block "never commit on $default: create a branch from origin/$default first (see AGENTS.md)."
  fi
  if grep -Eq 'gh[[:space:]]+pr[[:space:]]+merge' <<<"$cmd"; then
    block "merging a pull request is the user's decision."
  fi
  # A redirection or tee into a guardrail file (or inside a .git directory), or a file-changing
  # command that names one. For cp only the destination, the last argument, counts.
  bash_protected="$PROTECTED_REGEX|(^|[[:space:]/>])\.git/|(^|[[:space:]/])\.claude([[:space:]]|\$)"
  mutators=$(grep -Eo -- "(sed[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*-i|perl[[:space:]]+-[a-zA-Z]*i|\b(mv|rm|truncate|chmod|chown|ln|install|touch)[[:space:]]|${git}(checkout|restore|rm|mv)[[:space:]])[^|;&]*" <<<"$cmd" || true)
  cp_targets=$(grep -Eo -- '\bcp[[:space:]][^|;&]*' <<<"$cmd" | awk '{print $NF}' || true)
  if grep -Eq 'lefthook[[:space:]]+uninstall' <<<"$cmd"; then
    block "lefthook uninstall removes the Git hooks: they must always run."
  fi
  if grep -Eiq "(>|\btee([[:space:]]+-a)?)[[:space:]]*[^[:space:]]*($bash_protected|\.git/)" <<<"$cmd" ||
    grep -Eiq "$bash_protected" <<<"$mutators" ||
    grep -Eiq "$bash_protected" <<<"$cp_targets"; then
    block "this command looks like it changes a guardrail file. Only the user edits those: propose the change instead."
  fi
}

case "$tool" in
  Edit | Write | MultiEdit | NotebookEdit)
    check_file "$(jq -r '.tool_input.file_path // .tool_input.notebook_path' <<<"$input")"
    ;;
  Bash)
    check_bash "$(jq -r '.tool_input.command' <<<"$input")"
    ;;
esac
exit 0
