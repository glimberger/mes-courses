# Helpers shared by the Claude Code hooks in this folder. Sourced, not executed.

# Launching Claude Code with CLAUDE_GUARDRAILS_OFF=1 turns every hook off for that session.
# An agent cannot set it: hooks inherit the environment of the Claude Code process, not the
# environment of its Bash tool.
guardrails_off() {
  [ "${CLAUDE_GUARDRAILS_OFF:-}" = "1" ]
}

# Without jq the hooks cannot read their input and would let everything through: fail closed.
require_jq() {
  command -v jq >/dev/null 2>&1 || block "jq is required by the hooks in .claude/hooks (it is in the Nix dev shell)."
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
# the user edits them. One regular expression serves the file checks and the Bash command
# heuristics, and is matched case-insensitively (the default macOS file system is).
PROTECTED_REGEX='\.claude/settings(\.local)?\.json|\.claude/hooks/|lefthook\.yml|\.github/workflows/|\.dependency-cruiser\.cjs|\.talismanrc|agent-scope\.txt'

is_protected() {
  grep -Eiq "(^|/)($PROTECTED_REGEX)" <<<"$1"
}

# Prints a fingerprint of the working tree: HEAD, tracked changes, and the path and content of
# every untracked file. Always computed from the top of the tree, whatever the current directory.
tree_fingerprint() (
  cd "$(git rev-parse --show-toplevel)" || exit 1
  {
    git rev-parse HEAD
    git diff HEAD
    git ls-files --others --exclude-standard -z | while IFS= read -r -d '' file; do
      printf '%s %s\n' "$file" "$(git hash-object -- "$file" 2>/dev/null)"
    done
  } | git hash-object --stdin
)
