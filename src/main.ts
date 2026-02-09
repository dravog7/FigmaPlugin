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
  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Preparing export…' });

  const selection = figma.currentPage.selection;

  if (!selection.length) {
    figma.notify('Select at least one frame/layer to export.');
    figma.closePlugin();
    return;
  }

  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Collecting assets…' });

  const assets = await collectImageAssetsFromSelection(selection);
  const imagePathByHash = Object.fromEntries(assets.map((asset) => [asset.hash, asset.path]));

  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Serializing selection…' });

  const tree = await Promise.all(selection.map((node) => serializeNode(node, imagePathByHash)));

  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Collecting tokens…' });

  const tokens = await collectTokens();
  const payload = buildPayload(selection, tokens as Array<Record<string, unknown>>, tree, assets);

  figma.ui.postMessage({ type: PLUGIN_MESSAGES.EXPORT_PROGRESS, label: 'Building ZIP…' });

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
