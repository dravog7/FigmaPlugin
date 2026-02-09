import { cleanValue } from './utils';

type SerializedNode = Record<string, unknown>;

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

async function getCss(node: SceneNode, imagePathByHash: Record<string, string>): Promise<unknown> {
  if (!('getCSSAsync' in node)) {
    return null;
  }

  try {
    const css = await (node as SceneNode & { getCSSAsync(): Promise<unknown> }).getCSSAsync();
    const patchedCss = replaceImageHashesInValue(css, imagePathByHash);
    return cleanValue(patchedCss);
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

export async function serializeNode(node: SceneNode, imagePathByHash: Record<string, string>): Promise<SerializedNode> {
  const serialized: SerializedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    css: await getCss(node, imagePathByHash),
    text: getText(node),
    interactions: cleanValue(('reactions' in node ? node.reactions : null) as unknown)
  };

  if ('children' in node) {
    serialized.children = await Promise.all(node.children.map((child) => serializeNode(child, imagePathByHash)));
  }

  return serialized;
}
