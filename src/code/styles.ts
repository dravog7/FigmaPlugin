import { isMixed } from './utils';

export function serializeStyle(styleId: string | PluginAPI['mixed'] | ''): Record<string, unknown> | null {
  if (!styleId || isMixed(styleId)) {
    return null;
  }

  const style = figma.getStyleById(styleId);
  if (!style) {
    return null;
  }

  return {
    id: style.id,
    key: style.key,
    name: style.name,
    type: style.type,
    remote: style.remote,
    description: style.description
  };
}

export function collectStylesFromSelection(selection: ReadonlyArray<SceneNode>): Array<Record<string, unknown>> {
  const styleIds = new Set<string>();

  function remember(styleId: string | PluginAPI['mixed']) {
    if (styleId && !isMixed(styleId)) {
      styleIds.add(styleId);
    }
  }

  function walk(node: SceneNode) {
    if ('fillStyleId' in node) remember(node.fillStyleId);
    if ('strokeStyleId' in node) remember(node.strokeStyleId);
    if ('effectStyleId' in node) remember(node.effectStyleId);
    if ('textStyleId' in node) remember(node.textStyleId);

    if ('children' in node) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const node of selection) {
    walk(node);
  }

  const styles: Array<Record<string, unknown>> = [];
  for (const styleId of styleIds) {
    const style = serializeStyle(styleId);
    if (style) {
      styles.push(style);
    }
  }

  return styles;
}
