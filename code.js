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

function mapPaints(paints) {
  if (!paints || isMixed(paints)) {
    return null;
  }

  return paints.map((paint) => {
    if (!paint || paint.type !== 'IMAGE') {
      return paint;
    }

    return {
      ...paint,
      imageRef: paint.imageHash ? `assets/${paint.imageHash}` : null
    };
  });
}

function cleanValue(value) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (isMixed(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(cleanValue);
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      const cleaned = cleanValue(nested);
      if (cleaned !== undefined) {
        out[key] = cleaned;
      }
    }
    return out;
  }

  return value;
}

function serializeNode(node) {
  const serialized = {};

  for (const prop of NODE_PROPS) {
    if (!(prop in node)) {
      continue;
    }

    let value = node[prop];
    if ((prop === 'fills' || prop === 'strokes') && value) {
      value = mapPaints(value);
    }

    const cleaned = cleanValue(value);
    if (cleaned !== undefined) {
      serialized[prop] = cleaned;
    }
  }

  if ('children' in node) {
    serialized.children = node.children.map(serializeNode);
  }

  return serialized;
}

function collectStyles(nodes) {
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

  for (const node of nodes) {
    walk(node);
  }

  return Array.from(styleIds).map(serializeStyle).filter(Boolean);
}

async function collectImageAssets(nodes) {
  const hashes = new Set();

  function collectImagePaints(paints) {
    if (!paints || isMixed(paints)) {
      return;
    }

    for (const paint of paints) {
      if (paint?.type === 'IMAGE' && paint.imageHash) {
        hashes.add(paint.imageHash);
      }
    }
  }

  function walk(node) {
    if ('fills' in node) collectImagePaints(node.fills);
    if ('strokes' in node) collectImagePaints(node.strokes);

    if ('children' in node) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const node of nodes) {
    walk(node);
  }

  const assets = [];
  for (const hash of hashes) {
    const image = figma.getImageByHash(hash);
    if (!image) {
      continue;
    }

    const bytes = await image.getBytesAsync();
    assets.push({ hash, bytes });
  }

  return assets;
}

async function runExport() {
  const selection = figma.currentPage.selection;
  if (!selection.length) {
    figma.notify('Select at least one frame/layer to export.');
    figma.closePlugin();
    return;
  }

  const payload = {
    meta: {
      version: 1,
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      selectionCount: selection.length,
      exportedAt: new Date().toISOString()
    },
    styles: collectStyles(selection),
    tree: selection.map(serializeNode),
    assets: await collectImageAssets(selection)
  };

  figma.ui.postMessage({ type: 'export-payload', payload });
}

figma.ui.onmessage = (message) => {
  if (message.type === 'export-done') {
    figma.notify('Selection exported as ZIP.');
    figma.closePlugin();
    return;
  }

  if (message.type === 'export-failed') {
    figma.notify(`Failed to export ZIP: ${message.error || 'Unknown error'}`);
    figma.closePlugin();
  }
};

runExport();
