import { cleanValue, isMixed } from './utils';

type SerializedNode = Record<string, unknown>;

function getNodeImageHashes(node: SceneNode): string[] {
  const hashes = new Set<string>();

  function collectFromPaints(paints: ReadonlyArray<Paint> | PluginAPI['mixed']) {
    if (!paints || isMixed(paints)) {
      return;
    }

    for (const paint of paints) {
      if (paint && paint.type === 'IMAGE' && paint.imageHash) {
        hashes.add(paint.imageHash);
      }
    }
  }

  if ('fills' in node) {
    collectFromPaints(node.fills);
  }

  if ('strokes' in node) {
    collectFromPaints(node.strokes);
  }

  return Array.from(hashes);
}

function replaceImageHashesInValue(value: unknown, imagePathByHash: Record<string, string>): unknown {
  if (typeof value === 'string') {
    let next = value;
    for (const [hash, path] of Object.entries(imagePathByHash)) {
      if (next.includes(hash)) {
        next = next.split(hash).join(path);
      }
    }
    return next;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceImageHashesInValue(item, imagePathByHash));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const patched: Record<string, unknown> = {};
  for (const [key, current] of Object.entries(value)) {
    patched[key] = replaceImageHashesInValue(current, imagePathByHash);
  }

  return patched;
}

function patchCssPlaceholders(css: unknown, imagePaths: string[]): unknown {
  if (!css || typeof css !== 'object' || Array.isArray(css)) {
    return css;
  }

  const patched: Record<string, unknown> = {};
  let imageIndex = 0;

  for (const [key, value] of Object.entries(css as Record<string, unknown>)) {
    if (typeof value === 'string' && value.includes('<path-to-image>') && imagePaths.length) {
      const resolvedPath = imagePaths[Math.min(imageIndex, imagePaths.length - 1)];
      patched[key] = value.replace('<path-to-image>', resolvedPath);
      imageIndex += 1;
      continue;
    }

    patched[key] = value;
  }

  return patched;
}

async function getCss(node: SceneNode, imagePathByHash: Record<string, string>): Promise<unknown> {
  if (!('getCSSAsync' in node)) {
    return null;
  }

  try {
    const css = await (node as SceneNode & { getCSSAsync(): Promise<unknown> }).getCSSAsync();
    const patchedCss = replaceImageHashesInValue(css, imagePathByHash);
    const nodeImagePaths = getNodeImageHashes(node)
      .map((hash) => imagePathByHash[hash])
      .filter((value): value is string => Boolean(value));
    return cleanValue(patchCssPlaceholders(patchedCss, nodeImagePaths));
  } catch {
    return null;
  }
}

function getText(node: SceneNode): string | null {
  if (node.type !== 'TEXT') {
    return null;
  }

  return node.characters;
}

function getNodeImages(node: SceneNode, imagePathByHash: Record<string, string>): string[] {
  return getNodeImageHashes(node)
    .map((hash) => imagePathByHash[hash])
    .filter((value): value is string => Boolean(value));
}

export async function serializeNode(node: SceneNode, imagePathByHash: Record<string, string>): Promise<SerializedNode> {
  const serialized: SerializedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    css: await getCss(node, imagePathByHash),
    images: getNodeImages(node, imagePathByHash),
    text: getText(node),
    interactions: cleanValue(('reactions' in node ? node.reactions : null) as unknown)
  };

  if ('children' in node) {
    serialized.children = await Promise.all(node.children.map((child) => serializeNode(child, imagePathByHash)));
  }

  return serialized;
}
