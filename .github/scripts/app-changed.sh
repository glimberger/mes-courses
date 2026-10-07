#!/bin/sh
# Reads changed file paths on standard input, one per line.
# Prints "app=false" when every path is documentation (under specs/, under .specify/, or a
# Markdown file ending in .md), and "app=true" otherwise, including when there is no input.
# Constitution v2.2.0, research R17.

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
echo "app=$app"
