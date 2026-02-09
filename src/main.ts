import { PLUGIN_MESSAGES } from './constants';
import { buildPayload } from './payload';
import { serializeNode } from './serializer';
import { collectTokens } from './tokens';

figma.showUI(__html__, { visible: false });

async function exportSelectionToZip() {
  const selection = figma.currentPage.selection;

  if (!selection.length) {
    figma.notify('Select at least one frame/layer to export.');
    figma.closePlugin();
    return;
  }

  const tree = await Promise.all(selection.map((node) => serializeNode(node)));
  const tokens = await collectTokens();
  const payload = buildPayload(selection, tokens as Array<Record<string, unknown>>, tree);

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
