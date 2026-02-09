figma.showUI(__html__, { visible: false });

const NODE_PROPS = [
  'id',
  'type',
  'name',
  'visible',
  'locked',
  'opacity',
  'blendMode',
  'isMask',
  'maskType',
  'clipsContent',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'relativeTransform',
  'absoluteTransform',
  'constraints',
  'layoutAlign',
  'layoutGrow',
  'layoutMode',
  'layoutPositioning',
  'layoutWrap',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
  'primaryAxisSizingMode',
  'counterAxisSizingMode',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
  'strokesIncludedInLayout',
  'fills',
  'strokes',
  'strokeWeight',
  'strokeAlign',
  'strokeJoin',
  'strokeCap',
  'strokeMiterLimit',
  'dashPattern',
  'effects',
  'effectStyleId',
  'fillStyleId',
  'strokeStyleId',
  'textStyleId',
  'characters',
  'fontSize',
  'fontName',
  'textCase',
  'textDecoration',
  'textAlignHorizontal',
  'textAlignVertical',
  'textAutoResize',
  'lineHeight',
  'letterSpacing',
  'paragraphSpacing',
  'paragraphIndent',
  'listSpacing',
  'hyperlink',
  'maxLines',
  'exportSettings',
  'componentId',
  'componentProperties',
  'boundVariables'
];

function isMixed(value) {
  return value === figma.mixed;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneWithImageRef(paint) {
  const copy = {};
  for (const key in paint) {
    copy[key] = paint[key];
  }
  copy.imageRef = paint.imageHash ? 'assets/' + paint.imageHash : null;
  return copy;
}

function mapPaints(paints) {
  if (!paints || isMixed(paints)) {
    return null;
  }

  const mapped = [];
  for (const paint of paints) {
    if (!paint || paint.type !== 'IMAGE') {
      mapped.push(paint);
      continue;
    }

    mapped.push(cloneWithImageRef(paint));
  }

  return mapped;
}

function cleanValue(value) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (isMixed(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    const cleanedItems = [];
    for (const item of value) {
      cleanedItems.push(cleanValue(item));
    }
    return cleanedItems;
  }

  if (isObject(value)) {
    const cleanedObject = {};
    for (const key of Object.keys(value)) {
      const cleanedNested = cleanValue(value[key]);
      if (cleanedNested !== undefined) {
        cleanedObject[key] = cleanedNested;
      }
    }
    return cleanedObject;
  }

  return value;
}

function getSerializableNodeValue(node, prop) {
  if (!(prop in node)) {
    return undefined;
  }

  let value = node[prop];
  if ((prop === 'fills' || prop === 'strokes') && value) {
    value = mapPaints(value);
  }

  return cleanValue(value);
}

function serializeNode(node) {
  const serialized = {};

  for (const prop of NODE_PROPS) {
    const value = getSerializableNodeValue(node, prop);
    if (value !== undefined) {
      serialized[prop] = value;
    }
  }

  if ('children' in node) {
    const children = [];
    for (const child of node.children) {
      children.push(serializeNode(child));
    }
    serialized.children = children;
  }

  return serialized;
}

function serializeStyle(styleId) {
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

function collectStylesFromSelection(selection) {
  const styleIds = new Set();

  function remember(styleId) {
    if (styleId && !isMixed(styleId)) {
      styleIds.add(styleId);
    }
  }

  function walk(node) {
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

  const styles = [];
  for (const styleId of styleIds) {
    const style = serializeStyle(styleId);
    if (style) {
      styles.push(style);
    }
  }
  return styles;
}

async function collectImageAssetsFromSelection(selection) {
  const imageHashes = new Set();

  function collectPaintImages(paints) {
    if (!paints || isMixed(paints)) {
      return;
    }

    for (const paint of paints) {
      if (paint && paint.type === 'IMAGE' && paint.imageHash) {
        imageHashes.add(paint.imageHash);
      }
    }
  }

  function walk(node) {
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

  const assets = [];
  for (const hash of imageHashes) {
    const image = figma.getImageByHash(hash);
    if (!image) {
      continue;
    }

    const bytes = await image.getBytesAsync();
    assets.push({ hash: hash, bytes: bytes });
  }

  return assets;
}

function buildPayload(selection, styles, tree, assets) {
  return {
    meta: {
      version: 1,
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      selectionCount: selection.length,
      exportedAt: new Date().toISOString()
    },
    styles: styles,
    tree: tree,
    assets: assets
  };
}

async function exportSelectionToZip() {
  const selection = figma.currentPage.selection;
  if (!selection.length) {
    figma.notify('Select at least one frame/layer to export.');
    figma.closePlugin();
    return;
  }

  const styles = collectStylesFromSelection(selection);
  const tree = [];
  for (const node of selection) {
    tree.push(serializeNode(node));
  }
  const assets = await collectImageAssetsFromSelection(selection);
  const payload = buildPayload(selection, styles, tree, assets);

  figma.ui.postMessage({ type: 'export-payload', payload: payload });
}

function handleUiMessage(message) {
  if (message.type === 'export-done') {
    figma.notify('Selection exported as ZIP.');
    figma.closePlugin();
    return;
  }

  if (message.type === 'export-failed') {
    const reason = message.error || 'Unknown error';
    figma.notify('Failed to export ZIP: ' + reason);
    figma.closePlugin();
  }
}

figma.ui.onmessage = handleUiMessage;

exportSelectionToZip();
