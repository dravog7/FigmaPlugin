import { NODE_PROPS } from './constants';
import { cleanValue, isMixed } from './utils';

function cloneWithImageRef(paint: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const key in paint) {
    copy[key] = paint[key];
  }
  copy.imageRef = paint.imageHash ? `assets/${paint.imageHash}` : null;
  return copy;
}

function mapPaints(paints: ReadonlyArray<Paint> | PluginAPI['mixed']): unknown {
  if (!paints || isMixed(paints)) {
    return null;
  }

  return paints.map((paint) => {
    if (!paint || paint.type !== 'IMAGE') {
      return paint;
    }
    return cloneWithImageRef(paint as unknown as Record<string, unknown>);
  });
}

function getSerializableNodeValue(node: SceneNode, prop: string): unknown {
  if (!(prop in node)) {
    return undefined;
  }

  let value: unknown = (node as Record<string, unknown>)[prop];
  if ((prop === 'fills' || prop === 'strokes') && value) {
    value = mapPaints(value as ReadonlyArray<Paint> | PluginAPI['mixed']);
  }

  return cleanValue(value);
}

export function serializeNode(node: SceneNode): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const prop of NODE_PROPS) {
    const value = getSerializableNodeValue(node, prop);
    if (value !== undefined) {
      serialized[prop] = value;
    }
  }

  if ('children' in node) {
    serialized.children = node.children.map(serializeNode);
  }

  return serialized;
}
