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

input=$(cat)
tool=$(jq -r '.tool_name' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
project_dir=${CLAUDE_PROJECT_DIR:-$cwd}
project_common=$(git_common_dir "$project_dir")
[ -n "$project_common" ] || exit 0

check_file() {
  local file=$1 dir top rel branch default feature_dir number scope pattern
  case "$file" in /*) ;; *) file="$cwd/$file" ;; esac
  dir=$(existing_dir "$file")
  # Resolve symbolic links (/tmp is /private/tmp on macOS), as git rev-parse does.
  file="$(cd "$dir" && pwd -P)${file#"$dir"}"
  dir=$(existing_dir "$file")
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

  # Scope of the current Spec Kit feature, enforced only on that feature's own branch
  # (specs/003-server-sync matches a branch named like feat/003-...).
  feature_dir=$(jq -r '.feature_directory // empty' "$top/.specify/feature.json" 2>/dev/null)
  [ -n "$feature_dir" ] || return 0
  scope="$top/$feature_dir/agent-scope.txt"
  [ -f "$scope" ] || return 0
  number=${feature_dir##*/}
  number=${number%%-*}
  [[ "$branch" =~ (^|/)$number- ]] || return 0
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
}

check_bash() {
  local cmd=$1 branch default git
  branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
  default=$(default_branch "$cwd")
  # "git", optionally followed by -C <dir> or -c <key=value>.
  git='git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+'

  if grep -Eq -- '--no-verify|(^|[[:space:]])(LEFTHOOK|HUSKY)=0|LEFTHOOK_EXCLUDE=|core\.hooksPath' <<<"$cmd"; then
    block "Git hooks must always run: fix what the hook reports instead. (If these words only appear in a message, reword it.)"
  fi
  if grep -Eq -- "${git}commit([^|;&]*[[:space:]])?-n([[:space:]]|\$)" <<<"$cmd"; then
    block "git commit -n skips the Git hooks: fix what the hook reports instead."
  fi
  if grep -Eq -- "${git}push" <<<"$cmd"; then
    if grep -Eq -- '[[:space:]](--force|-f)([[:space:]]|=|$)|[[:space:]]\+[^[:space:]]+' <<<"$cmd"; then
      block "force push is not allowed. Use --force-with-lease on your own feature branch."
    fi
    if [ "$branch" = "$default" ] || grep -Eq "([[:space:]]|:)$default([[:space:]]|\$)" <<<"$cmd"; then
      block "never push to $default (or from it): open a pull request from a feature branch."
    fi
  fi
  if [ "$branch" = "$default" ] && grep -Eq -- "${git}commit" <<<"$cmd"; then
    block "never commit on $default: create a branch from origin/$default first (see AGENTS.md)."
  fi
  if grep -Eq 'gh[[:space:]]+pr[[:space:]]+merge' <<<"$cmd"; then
    block "merging a pull request is the user's decision."
  fi
  # A redirection or tee into a guardrail file, or a file-changing command that names one.
  if grep -Eq "(>|\btee([[:space:]]+-a)?)[[:space:]]*[^[:space:]]*($PROTECTED_REGEX)" <<<"$cmd" ||
    { grep -Eq "$PROTECTED_REGEX" <<<"$cmd" &&
      grep -Eq "sed[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*-i|perl[[:space:]]+-[a-zA-Z]*i|\b(mv|cp|rm|truncate)[[:space:]]|${git}(checkout|restore|rm|mv)[[:space:]]" <<<"$cmd"; }; then
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
