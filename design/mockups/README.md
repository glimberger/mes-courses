# UI mockups — "basket identity" redesign

Static HTML/CSS mockups of the Material 3 UI redesign proposal (October 2026): Nunito
everywhere, brand yellow `#FFDE3F` as the action color, rounded cards (16 dp), 28 dp
dialogs, light and dark schemes. They are the reference target for the UI refresh feature.

## View them

From this folder:

```sh
python3 -m http.server 8931
# then open http://localhost:8931/
```

`index.html` is a gallery of every screen (Écrans · Dialogues · Démarrage). Each mockup
also opens directly (`1-liste.html`, `7-dialog-quantite.html`, …).

- Everything is relative: the folder is self-contained (`assets/` holds the splash image,
  the dialog backdrops are iframes of the screen mockups).
- Nunito and the Material Symbols icons load from Google Fonts: view them with a network
  connection for a faithful rendering.
- `shots/` holds the PNG captures of each mockup (393×852 @2x), used in discussions.

These are design proposals, not the app: the app theme lives in `../material-theme.json`
and the screens in `apps/mobile/src/adapters/ui/`.
