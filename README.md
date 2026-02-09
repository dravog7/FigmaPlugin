# Figma Selection ZIP Exporter

This plugin exports the current selection to a single ZIP file:

- `design.json`: full selected node tree, metadata, and style references.
- `assets/`: binary image assets used by fills/strokes.

`design.json` image paints include `imageRef` paths pointing to files in `assets/`.

## Usage

1. Select one or more layers/frames in Figma.
2. Run **Selection to ZIP Exporter**.
3. Download `figma-design-export.zip`.
