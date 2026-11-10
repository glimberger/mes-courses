#!/bin/sh
# Usage: app-changed.sh [<pull request title> <base> <head>]
# Reads changed file paths on standard input, one per line.
# Prints "app=false" when every path is documentation (under specs/, under .specify/, or a
# Markdown file ending in .md), and "app=true" otherwise, including when there is no input.
# With the three optional arguments, a release bump (release-bump.sh: bump title, bump files,
# `version` line the only change in app.config.ts) is also "app=false".
# Constitution v2.7.0, research R17.

dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

app=false
seen=false
while IFS= read -r path || [ -n "$path" ]; do
  [ -n "$path" ] || continue
  seen=true
  case "$path" in
    specs/* | .specify/* | *.md) ;;
    *) app=true ;;
  esac
done
[ "$seen" = true ] || app=true
if [ "$app" = true ] && [ "$#" -ge 3 ] && [ "$(sh "$dir/release-bump.sh" "$1" "$2" "$3")" = "bump=true" ]; then
  app=false
fi
echo "app=$app"
