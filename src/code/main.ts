import './shim';
import { collectImageAssetsFromSelection } from './assets';
import { PLUGIN_MESSAGES } from './constants';
import { buildPayload } from './payload';
import { serializeNode } from './serializer';
import { collectTokens } from './tokens';

figma.showUI(__html__, {
  width: 320,
  height: 120,
  themeColors: true
});

async function exportSelectionToZip() {
  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Preparing export…', progress: 0 });

  const selection = figma.currentPage.selection;

  if (!selection.length) {
    figma.notify('Select at least one frame/layer to export.');
    figma.closePlugin();
    return;
  }

  // Phase 1: Assets (0-40%)
  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Scanning for images…', progress: 5 });

  const assets = await collectImageAssetsFromSelection(selection, (current, total) => {
    const percentage = Math.round((current / total) * 40);
    figma.ui.postMessage({
      type: PLUGIN_MESSAGES.EXPORT_PROGRESS,
      label: `Collecting images (${current}/${total})…`,
      progress: percentage
    });
  });

  const imagePathByHash = assets.reduce((acc, asset) => {
    acc[asset.hash] = asset.path;
    return acc;
  }, {} as Record<string, string>);

  // Phase 2: Serialization (40-70%)
  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Serializing selection…', progress: 40 });

  let serializedCount = 0;
  const totalNodes = selection.length;

  const tree = await Promise.all(selection.map(async (node) => {
    const result = await serializeNode(node, imagePathByHash);
    serializedCount++;
    const percentage = 40 + Math.round((serializedCount / totalNodes) * 30);
    figma.ui.postMessage({
      type: PLUGIN_MESSAGES.EXPORT_PROGRESS,
      label: `Serializing nodes (${serializedCount}/${totalNodes})…`,
      progress: percentage
    });
    return result;
  }));

  // Phase 3: Tokens (70-80%)
  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Collecting tokens…', progress: 75 });

  const tokens = await collectTokens();
  const payload = buildPayload(selection, tokens as Array<Record<string, unknown>>, tree, assets);

  // Send payload to UI for TOON conversion and Zipping
  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PAYLOAD, payload });
}

function handleUiMessage(message: { type: string; error?: string }) {
  if (message.type === PLUGIN_MESSAGES.EXPORT_DONE) {
    figma.notify('Selection exported as ZIP.');
    figma.closePlugin();
    return;
  }

  if (message.type === PLUGIN_MESSAGES.EXPORT_FAILED) {
    figma.notify(`Failed to export ZIP: ${message.error || 'Unknown error'}`);
    figma.closePlugin();
  }
}

figma.ui.onmessage = handleUiMessage;

void exportSelectionToZip();
