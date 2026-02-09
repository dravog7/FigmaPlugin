figma.showUI(__html__, { visible: false });

async function collectImageAssets(roots) {
  const imageHashes = new Set();

  function collectPaintImages(paints) {
    if (!paints || paints === figma.mixed) {
      return;
    }

    for (const paint of paints) {
      if (paint && paint.type === 'IMAGE' && paint.imageHash) {
        imageHashes.add(paint.imageHash);
      }
    }
  }

  function walk(node) {
    if ('fills' in node) {
      collectPaintImages(node.fills);
    }

    if ('strokes' in node) {
      collectPaintImages(node.strokes);
    }

    if ('children' in node) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const root of roots) {
    walk(root);
  }

  const assets = [];
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

function serializeStyle(styleId) {
  if (!styleId || styleId === figma.mixed) {
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

function toSerializablePaints(paints) {
  if (!paints || paints === figma.mixed) {
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

function serializeNode(node) {
  const serialized = {
    id: node.id,
    type: node.type,
    name: node.name,
    visible: node.visible,
    locked: node.locked,
    opacity: 'opacity' in node ? node.opacity : undefined,
    blendMode: 'blendMode' in node ? node.blendMode : undefined,
    x: 'x' in node ? node.x : undefined,
    y: 'y' in node ? node.y : undefined,
    width: 'width' in node ? node.width : undefined,
    height: 'height' in node ? node.height : undefined,
    rotation: 'rotation' in node ? node.rotation : undefined,
    relativeTransform: 'relativeTransform' in node ? node.relativeTransform : undefined,
    fills: 'fills' in node ? toSerializablePaints(node.fills) : undefined,
    strokes: 'strokes' in node ? toSerializablePaints(node.strokes) : undefined,
    effects: 'effects' in node ? node.effects : undefined,
    exportSettings: 'exportSettings' in node ? node.exportSettings : undefined,
    constraints: 'constraints' in node ? node.constraints : undefined,
    layoutAlign: 'layoutAlign' in node ? node.layoutAlign : undefined,
    layoutGrow: 'layoutGrow' in node ? node.layoutGrow : undefined,
    layoutMode: 'layoutMode' in node ? node.layoutMode : undefined,
    itemSpacing: 'itemSpacing' in node ? node.itemSpacing : undefined,
    counterAxisSpacing: 'counterAxisSpacing' in node ? node.counterAxisSpacing : undefined,
    paddingTop: 'paddingTop' in node ? node.paddingTop : undefined,
    paddingRight: 'paddingRight' in node ? node.paddingRight : undefined,
    paddingBottom: 'paddingBottom' in node ? node.paddingBottom : undefined,
    paddingLeft: 'paddingLeft' in node ? node.paddingLeft : undefined,
    cornerRadius: 'cornerRadius' in node ? node.cornerRadius : undefined,
    topLeftRadius: 'topLeftRadius' in node ? node.topLeftRadius : undefined,
    topRightRadius: 'topRightRadius' in node ? node.topRightRadius : undefined,
    bottomLeftRadius: 'bottomLeftRadius' in node ? node.bottomLeftRadius : undefined,
    bottomRightRadius: 'bottomRightRadius' in node ? node.bottomRightRadius : undefined,
    characters: 'characters' in node ? node.characters : undefined,
    fontSize: 'fontSize' in node ? node.fontSize : undefined,
    fontName: 'fontName' in node ? node.fontName : undefined,
    textAlignHorizontal: 'textAlignHorizontal' in node ? node.textAlignHorizontal : undefined,
    textAlignVertical: 'textAlignVertical' in node ? node.textAlignVertical : undefined,
    textAutoResize: 'textAutoResize' in node ? node.textAutoResize : undefined,
    lineHeight: 'lineHeight' in node ? node.lineHeight : undefined,
    letterSpacing: 'letterSpacing' in node ? node.letterSpacing : undefined,
    paragraphSpacing: 'paragraphSpacing' in node ? node.paragraphSpacing : undefined,
    fillStyleId: 'fillStyleId' in node ? node.fillStyleId : undefined,
    strokeStyleId: 'strokeStyleId' in node ? node.strokeStyleId : undefined,
    effectStyleId: 'effectStyleId' in node ? node.effectStyleId : undefined,
    textStyleId: 'textStyleId' in node ? node.textStyleId : undefined,
    componentId: 'componentId' in node ? node.componentId : undefined,
    componentProperties: 'componentProperties' in node ? node.componentProperties : undefined,
    styleReferences: 'styleId' in node ? node.styleId : undefined,
    boundVariables: 'boundVariables' in node ? node.boundVariables : undefined,
    children: 'children' in node ? node.children.map(serializeNode) : undefined
  };

  return Object.fromEntries(Object.entries(serialized).filter(([, value]) => value !== undefined));
}

function collectStyles(nodes) {
  const styleIds = new Set();

  function remember(styleId) {
    if (styleId && styleId !== figma.mixed) {
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

  return Array.from(styleIds)
    .map(serializeStyle)
    .filter(Boolean);
}

async function runExport() {
  if (figma.currentPage.selection.length === 0) {
    figma.notify('Select at least one frame/layer to export.');
    figma.closePlugin();
    return;
  }

  const selection = figma.currentPage.selection;
  const styles = collectStyles(selection);
  const assets = await collectImageAssets(selection);
  const tree = selection.map(serializeNode);

  figma.ui.postMessage({
    type: 'export-payload',
    payload: {
      meta: {
        fileName: figma.root.name,
        pageName: figma.currentPage.name,
        exportedAt: new Date().toISOString()
      },
      styles,
      tree,
      assets
    }
  });
}

figma.ui.onmessage = (message) => {
  if (message.type === 'export-done') {
    figma.notify('Selection exported as ZIP.');
    figma.closePlugin();
  }

  if (message.type === 'export-failed') {
    figma.notify(`Failed to export ZIP: ${message.error || 'Unknown error'}`);
    figma.closePlugin();
  }
};

runExport();
