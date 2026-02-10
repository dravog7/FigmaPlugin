# Figma Selection ZIP Exporter

Export selected Figma nodes as a high-performance ZIP archive containing:

- `design.toon` with node tree, style references, and metadata in **TOON** (Token-Optimized Object Notation) format for LLM efficiency.
- `assets/` folder with image binaries used in fills/strokes.

The plugin features a modern React UI with a real-time progress bar and uses `fflate` for fast compression.

## Development install (Figma Desktop)

1. Clone this repo locally.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin (UI and Controller):
   ```bash
   npm run build
   ```
4. In Figma desktop, go to **Plugins → Development → Import plugin from manifest…**.
5. Choose this repo's `manifest.json`.
6. Open any Figma file, select one or more layers/frames.
7. Run **Plugins → Development → Selection to ZIP Exporter**.
8. The plugin processes the selection and downloads `figma-design-export.zip`.

## Code organization

- `src/code/`: Plugin sandbox logic (interacts with Figma document).
  - `main.ts`: Entry point.
  - `serializer.ts`, `assets.ts`, etc.: Helper modules.
- `src/ui/`: React-based UI (runs in iframe).
  - `main.tsx`: React entry point.
  - `App.tsx`: Main component with Progress Bar and ZIP generation logic.
- `src/toon/`: Custom TOON serializer implementation.
- `vite.config.ts`: Build configuration for the UI.

## Technology Stack

- **Vite**: Fast build tool for the UI.
- **React**: Modern UI library for the plugin interface.
- **fflate**: High-performance, lightweight ZIP library.
- **file-type**: Robust detection of image binary types.
- **TOON**: Custom serialization format optimized for Large Language Models.

## Notes

- `dist/code.js` and `dist/index.html` are generated from the build process.
- ZIP generation and TOON serialization are offloaded to the UI thread to keep the Figma UI responsive.
