import type { ExportedAsset } from './assets';

export function buildPayload(
  selection: ReadonlyArray<SceneNode>,
  tokens: Array<Record<string, unknown>>,
  tree: Array<Record<string, unknown>>,
  assets: ExportedAsset[]
) {
  return {
    meta: {
      version: 1,
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      selectionCount: selection.length,
      exportedAt: new Date().toISOString()
    },
    tokens,
    tree,
    assets
  };
}
