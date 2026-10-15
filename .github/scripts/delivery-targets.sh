#!/bin/sh
# Reads changed file paths on standard input, one per line.
# Prints "server=true|false" and "app=true|false": which delivery targets the paths affect.
# Research R2. Documentation, specs, tests and other workflows affect neither target. With no
# input nothing is built; the caller decides what to do when it has no baseline.

server=false
app=false
while IFS= read -r path || [ -n "$path" ]; do
  [ -n "$path" ] || continue
  case "$path" in
    deploy/fdroid/*) app=true ;;
    apps/server/* | deploy/*) server=true ;;
    apps/mobile/*) app=true ;;
    packages/* | package.json | yarn.lock | .yarnrc.yml | .yarn/* | flake.*)
      server=true
      app=true
      ;;
    .github/workflows/deliver-staging.yml | .github/scripts/delivery-* | apps/delivery/*)
      server=true
      app=true
      ;;
    *) ;;
  esac
done
echo "server=$server"
echo "app=$app"
