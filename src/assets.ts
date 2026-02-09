import { isMixed } from './utils';

export type ExportedAsset = {
  hash: string;
  path: string;
  bytes: Uint8Array;
};

function detectExtension(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'gif';
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'bmp';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return 'bin';
}

function sanitizeForFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
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

export async function collectImageAssetsFromSelection(selection: ReadonlyArray<SceneNode>): Promise<ExportedAsset[]> {
  const imageUsageByHash = new Map<string, string>();

  function walk(node: SceneNode, parentPath: string) {
    const nodePart = sanitizeForFileName(node.name) || node.type.toLowerCase();
    const usageName = parentPath ? `${parentPath}-${nodePart}` : nodePart;

    if ('fills' in node) collectPaintImages(node.fills, imageUsageByHash, usageName);
    if ('strokes' in node) collectPaintImages(node.strokes, imageUsageByHash, usageName);

    if ('children' in node) {
      for (const child of node.children) {
        walk(child, usageName);
      }
    }
  }

  for (const node of selection) {
    walk(node, '');
  }

  const assets: ExportedAsset[] = [];
  for (const [hash, usageName] of imageUsageByHash.entries()) {
    const image = figma.getImageByHash(hash);
    if (!image) {
      continue;
    }

    const bytes = await image.getBytesAsync();
    const extension = detectExtension(bytes);
    const shortHash = hash.slice(0, 3).toLowerCase();
    const path = `assets/${usageName}-${shortHash}.${extension}`;

    assets.push({ hash, path, bytes });
  }

  return assets;
}
