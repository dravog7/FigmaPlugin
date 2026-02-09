import { cleanValue } from './utils';

type SerializedNode = Record<string, unknown>;

async function getCss(node: SceneNode): Promise<unknown> {
  if (!('getCSSAsync' in node)) {
    return null;
  }

  try {
    const css = await (node as SceneNode & { getCSSAsync(): Promise<unknown> }).getCSSAsync();
    return cleanValue(css);
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

export async function serializeNode(node: SceneNode): Promise<SerializedNode> {
  const serialized: SerializedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    css: await getCss(node),
    text: getText(node),
    interactions: cleanValue(('reactions' in node ? node.reactions : null) as unknown)
  };

  if ('children' in node) {
    serialized.children = await Promise.all(node.children.map((child) => serializeNode(child)));
  }

  return serialized;
}
