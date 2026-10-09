# Helpers shared by the Claude Code hooks in this folder. Sourced, not executed.

# Launching Claude Code with CLAUDE_GUARDRAILS_OFF=1 turns every hook off for that session.
# An agent cannot set it: hooks inherit the environment of the Claude Code process, not the
# environment of its Bash tool.
guardrails_off() {
  [ "${CLAUDE_GUARDRAILS_OFF:-}" = "1" ]
}

# Prints a message for the agent and blocks the tool call (exit code 2).
block() {
  printf 'Blocked by .claude/hooks: %s\n' "$*" >&2
  exit 2
}

# Prints the closest existing directory for a path that may not exist yet (Write can create
# new folders).
existing_dir() {
  local dir
  dir=$(dirname "$1")
  while [ ! -d "$dir" ]; do dir=$(dirname "$dir"); done
  printf '%s\n' "$dir"
}

# Prints the absolute Git common directory of a working tree, shared by all its worktrees.
git_common_dir() {
  git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null
}

# Prints the repository default branch, read from origin/HEAD, falling back to main.
default_branch() {
  local ref
  ref=$(git -C "$1" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
  printf '%s\n' "${ref#origin/}" | sed 's/^$/main/'
}

# Files that hold the guardrails themselves. An agent must not loosen its own limits: only
# the user edits them.
is_protected() {
  case "$1" in
    .claude/settings.json | .claude/hooks/* | lefthook.yml | .github/workflows/* | \
      .dependency-cruiser.cjs | .talismanrc | specs/*/agent-scope.txt) return 0 ;;
  esac
  return 1
}

# Same list as a regular expression, for the Bash command heuristics.
PROTECTED_REGEX='\.claude/settings\.json|\.claude/hooks/|lefthook\.yml|\.github/workflows/|\.dependency-cruiser\.cjs|\.talismanrc|agent-scope\.txt'
