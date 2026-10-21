# Icons

The app draws its icons from a Material Symbols Rounded font subset to the names listed in
`apps/mobile/src/adapters/ui/icons/symbols.txt`. After adding or removing a name there,
regenerate the font and the glyph table, then commit the result:

```sh
design/icons/build-symbols.sh   # needs network access and nix
```

Rerunning it without a change leaves no diff.
