# Figma Selection ZIP Exporter

Export selected Figma nodes as a ZIP archive containing:

- `design.json` with node tree, style references, and metadata
- `assets/` folder with image binaries used in fills/strokes

Each image paint in `design.json` includes `imageRef` pointing to the matching file in `assets/`.

## Development install (Figma Desktop)

1. Clone this repo locally.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin controller bundle:
   ```bash
   npm run build
   ```
4. In Figma desktop, go to **Plugins → Development → Import plugin from manifest…**.
5. Choose this repo's `manifest.json`.
6. Open any Figma file, select one or more layers/frames.
7. Run **Plugins → Development → Selection to ZIP Exporter**.
8. The plugin downloads `figma-design-export.zip`.

## Code organization

- `src/main.ts`: entrypoint and plugin orchestration
- `src/serializer.ts`: node serialization helpers
- `src/styles.ts`: style extraction
- `src/assets.ts`: image asset extraction
- `src/payload.ts`: payload metadata builder
- `src/constants.ts`, `src/utils.ts`: shared constants/utilities

## Notes

- `code.js` is generated from TypeScript (`npm run build`).
- ZIP is generated in-browser without external dependencies.
- Assets are stored as `assets/<image-hash>.<ext>` (`png`, `jpg`, `gif`, `bmp`, `webp`, or `bin`).
