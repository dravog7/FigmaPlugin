"use strict";
(() => {
  // src/utils.ts
  function isMixed(value) {
    return value === figma.mixed;
  }
  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  function cleanValue(value) {
    if (value === void 0 || typeof value === "function" || typeof value === "symbol") {
      return void 0;
    }
    if (isMixed(value)) {
      return null;
    }
    if (Array.isArray(value)) {
      return value.map(cleanValue);
    }
    if (isObject(value)) {
      const cleanedObject = {};
      for (const key of Object.keys(value)) {
        const cleanedNested = cleanValue(value[key]);
        if (cleanedNested !== void 0) {
          cleanedObject[key] = cleanedNested;
        }
      }
      return cleanedObject;
    }
    return value;
  }

  // src/assets.ts
  function detectExtension(bytes) {
    if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
      return "png";
    }
    if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      return "jpg";
    }
    if (bytes.length >= 6 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70) {
      return "gif";
    }
    if (bytes.length >= 2 && bytes[0] === 66 && bytes[1] === 77) {
      return "bmp";
    }
    if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) {
      return "webp";
    }
    return "bin";
  }
  function sanitizeForFileName(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  }
  function collectPaintImages(paints, imageUsageByHash, usageName) {
    if (!paints || isMixed(paints)) {
      return;
    }
    for (const paint of paints) {
      if (!paint || paint.type !== "IMAGE" || !paint.imageHash || imageUsageByHash.has(paint.imageHash)) {
        continue;
      }
      imageUsageByHash.set(paint.imageHash, usageName);
    }
  }
  function clampUsageName(usageName) {
    if (usageName.length <= 96) {
      return usageName;
    }
    return usageName.slice(0, 96);
  }
  function buildUniquePath(usageName, shortHash, extension, usedPaths, fullHash) {
    const baseName = `${clampUsageName(usageName)}-${shortHash}`;
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
  async function collectImageAssetsFromSelection(selection) {
    const imageUsageByHash = /* @__PURE__ */ new Map();
    function walk(node, parentPath) {
      const nodePart = sanitizeForFileName(node.name) || node.type.toLowerCase();
      const usageName = parentPath ? `${parentPath}-${nodePart}` : nodePart;
      if ("fills" in node) collectPaintImages(node.fills, imageUsageByHash, usageName);
      if ("strokes" in node) collectPaintImages(node.strokes, imageUsageByHash, usageName);
      if ("children" in node) {
        for (const child of node.children) {
          walk(child, usageName);
        }
      }
    }
    for (const node of selection) {
      walk(node, "");
    }
    const assets = [];
    const usedPaths = /* @__PURE__ */ new Set();
    for (const [hash, usageName] of imageUsageByHash.entries()) {
      const image = figma.getImageByHash(hash);
      if (!image) {
        continue;
      }
      const bytes = await image.getBytesAsync();
      const extension = detectExtension(bytes);
      const shortHash = hash.slice(0, 3).toLowerCase();
      const path = buildUniquePath(usageName || "image", shortHash, extension, usedPaths, hash);
      assets.push({ hash, path, bytes });
    }
    return assets;
  }

  // src/constants.ts
  var PLUGIN_MESSAGES = {
    EXPORT_PAYLOAD: "export-payload",
    EXPORT_DONE: "export-done",
    EXPORT_FAILED: "export-failed"
  };

  // src/payload.ts
  function buildPayload(selection, tokens, tree, assets) {
    return {
      meta: {
        version: 1,
        fileName: figma.root.name,
        pageName: figma.currentPage.name,
        selectionCount: selection.length,
        exportedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      tokens,
      tree,
      assets
    };
  }

  // src/serializer.ts
  function replaceImageHashesInValue(value, imagePathByHash) {
    if (typeof value === "string") {
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
    if (!value || typeof value !== "object") {
      return value;
    }
    const patched = {};
    for (const [key, current] of Object.entries(value)) {
      patched[key] = replaceImageHashesInValue(current, imagePathByHash);
    }
    return patched;
  }
  async function getCss(node, imagePathByHash) {
    if (!("getCSSAsync" in node)) {
      return null;
    }
    try {
      const css = await node.getCSSAsync();
      const patchedCss = replaceImageHashesInValue(css, imagePathByHash);
      return cleanValue(patchedCss);
    } catch (e) {
      return null;
    }
  }
  function getText(node) {
    if (node.type !== "TEXT") {
      return null;
    }
    return node.characters;
  }
  async function serializeNode(node, imagePathByHash) {
    const serialized = {
      id: node.id,
      name: node.name,
      type: node.type,
      css: await getCss(node, imagePathByHash),
      text: getText(node),
      interactions: cleanValue("reactions" in node ? node.reactions : null)
    };
    if ("children" in node) {
      serialized.children = await Promise.all(node.children.map((child) => serializeNode(child, imagePathByHash)));
    }
    return serialized;
  }

  // src/tokens.ts
  async function collectTokens() {
    const variables = await figma.variables.getLocalVariablesAsync();
    return variables.map((variable) => ({
      key: variable.key,
      name: variable.name,
      type: variable.resolvedType,
      value: cleanValue(variable.valuesByMode)
    }));
  }

  // src/main.ts
  figma.showUI(__html__, { visible: false });
  async function exportSelectionToZip() {
    const selection = figma.currentPage.selection;
    if (!selection.length) {
      figma.notify("Select at least one frame/layer to export.");
      figma.closePlugin();
      return;
    }
    const assets = await collectImageAssetsFromSelection(selection);
    const imagePathByHash = Object.fromEntries(assets.map((asset) => [asset.hash, asset.path]));
    const tree = await Promise.all(selection.map((node) => serializeNode(node, imagePathByHash)));
    const tokens = await collectTokens();
    const payload = buildPayload(selection, tokens, tree, assets);
    figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PAYLOAD, payload });
  }
  function handleUiMessage(message) {
    if (message.type === PLUGIN_MESSAGES.EXPORT_DONE) {
      figma.notify("Selection exported as ZIP.");
      figma.closePlugin();
      return;
    }
    if (message.type === PLUGIN_MESSAGES.EXPORT_FAILED) {
      figma.notify(`Failed to export ZIP: ${message.error || "Unknown error"}`);
      figma.closePlugin();
    }
  }
  figma.ui.onmessage = handleUiMessage;
  void exportSelectionToZip();
})();
