#!/bin/sh
# Usage: release-notes.sh <X.Y.Z> [CHANGELOG.md]
# Prints the body of the "## [X.Y.Z]" section of the changelog (up to the next "## [" heading),
# without the heading line and without leading or trailing blank lines. The version is matched
# exactly. Exit 1 when the section is missing or empty, 2 on a usage error.
# Used by .github/workflows/release.yml to write the GitHub Release body.

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || [ -z "$1" ]; then
  echo "Usage: release-notes.sh <X.Y.Z> [CHANGELOG.md]" >&2
  exit 2
fi
version=$1
file=${2:-CHANGELOG.md}
if [ ! -f "$file" ]; then
  echo "No such file: $file" >&2
  exit 2
fi

body=$(
  awk -v heading="## [$version]" '
    index($0, "## [") == 1 {
      found = (substr($0, 1, length(heading)) == heading)
      next
    }
    found { print }
  ' "$file" | awk '
    NF { for (i = 0; i < blanks; i++) print ""; blanks = 0; print; started = 1; next }
    started { blanks++ }
  '
)
if [ -z "$body" ]; then
  echo "No changelog section for $version in $file" >&2
  exit 1
fi
printf '%s\n' "$body"
