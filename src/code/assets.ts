import { fromBuffer } from 'file-type/core';
import { isMixed } from './utils';

export type ExportedAsset = {
  hash: string;
  path: string;
  bytes: Uint8Array;
};

function sanitizeForFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function collectPaintImages(
  paints: ReadonlyArray<Paint> | PluginAPI['mixed'],
  imageUsageByHash: Map<string, string>,
  usageName: string
) {
  if (!paints || isMixed(paints)) {
    return;
  }

  for (const paint of paints) {
    if (!paint || paint.type !== 'IMAGE' || !paint.imageHash || imageUsageByHash.has(paint.imageHash)) {
      continue;
    }

    imageUsageByHash.set(paint.imageHash, usageName);
  }
}

function buildUniquePath(
  usageName: string,
  shortHash: string,
  extension: string,
  usedPaths: Set<string>,
  fullHash: string
): string {
  const safeName = usageName || 'image';
  const baseName = `${safeName}-${shortHash}`;
  let path = `assets/${baseName}.${extension}`;

  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const collisionSuffix = fullHash.slice(3, 6).toLowerCase();
  path = `assets/${baseName}-${collisionSuffix}.${extension}`;

  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  let index = 2;
  while (usedPaths.has(path)) {
    path = `assets/${baseName}-${collisionSuffix}-${index}.${extension}`;
    index += 1;
  }

  usedPaths.add(path);
  return path;
}

export async function collectImageAssetsFromSelection(
  selection: ReadonlyArray<SceneNode>,
  onProgress?: (current: number, total: number) => void
): Promise<ExportedAsset[]> {
  const imageUsageByHash = new Map<string, string>();

  const stack: SceneNode[] = [...selection];

  while (stack.length > 0) {
    const node = stack.pop()!;
    const usageName = sanitizeForFileName(node.name) || node.type.toLowerCase();

    if ('fills' in node) collectPaintImages(node.fills, imageUsageByHash, usageName);
    if ('strokes' in node) collectPaintImages(node.strokes, imageUsageByHash, usageName);

    if ('children' in node) {
      // Push children to stack. Reversing ensures order is preserved if we popped from end,
      // but for asset collection order doesn't strictly matter.
      // Pushing directly means we traverse depth-first, right-to-left.
      // To traverse left-to-right (visual order), we should push reversed children.
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }

  const assets: ExportedAsset[] = [];
  const usedPaths = new Set<string>();
  const totalImages = imageUsageByHash.size;
  let processedImages = 0;

  for (const [hash, usageName] of imageUsageByHash.entries()) {
    processedImages++;
    if (onProgress) {
      onProgress(processedImages, totalImages);
    }

    const image = figma.getImageByHash(hash);
    if (!image) {
      continue;
    }

    const bytes = await image.getBytesAsync();

    // Retrieve file type using library
    const type = await fromBuffer(bytes);
    const extension = type ? type.ext : 'bin';

    const shortHash = hash.slice(0, 3).toLowerCase();
    const path = buildUniquePath(usageName, shortHash, extension, usedPaths, hash);

    assets.push({ hash, path, bytes });
  }

  return assets;
}
