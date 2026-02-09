# Figma Selection ZIP Exporter

Export selected Figma nodes as a ZIP archive containing:

- `design.json` with node tree, style references, and metadata
- `assets/` folder with image binaries used in fills/strokes

Each image paint in `design.json` includes `imageRef` pointing to the matching file in `assets/`.

## Development install (Figma Desktop)

1. Clone this repo locally.
2. In Figma desktop, go to **Plugins → Development → Import plugin from manifest…**.
3. Choose this repo's `manifest.json`.
4. Open any Figma file, select one or more layers/frames.
5. Run **Plugins → Development → Selection to ZIP Exporter**.
6. The plugin downloads `figma-design-export.zip`.

## Notes

- ZIP is generated in-browser without external dependencies.
- Assets are stored as `assets/<image-hash>.<ext>` (`png`, `jpg`, `gif`, `bmp`, `webp`, or `bin`).
