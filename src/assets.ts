import { isMixed } from './utils';

export type ExportedAsset = {
  hash: string;
  bytes: Uint8Array;
};

export async function collectImageAssetsFromSelection(selection: ReadonlyArray<SceneNode>): Promise<ExportedAsset[]> {
  const imageHashes = new Set<string>();

  function collectPaintImages(paints: ReadonlyArray<Paint> | PluginAPI['mixed']) {
    if (!paints || isMixed(paints)) {
      return;
    }

    for (const paint of paints) {
      if (paint && paint.type === 'IMAGE' && paint.imageHash) {
        imageHashes.add(paint.imageHash);
      }
    }
  }

  function walk(node: SceneNode) {
    if ('fills' in node) collectPaintImages(node.fills);
    if ('strokes' in node) collectPaintImages(node.strokes);

    if ('children' in node) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const node of selection) {
    walk(node);
  }

  const assets: ExportedAsset[] = [];
  for (const hash of imageHashes) {
    const image = figma.getImageByHash(hash);
    if (!image) {
      continue;
    }

    const bytes = await image.getBytesAsync();
    assets.push({ hash, bytes });
  }

  return assets;
}
