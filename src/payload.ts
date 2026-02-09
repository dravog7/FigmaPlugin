export function buildPayload(
  selection: ReadonlyArray<SceneNode>,
  tokens: Array<Record<string, unknown>>,
  tree: Array<Record<string, unknown>>
) {
  return {
    meta: {
      version: 1,
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      selectionCount: selection.length,
      exportedAt: new Date().toISOString()
    },
    tokens,
    tree
  };
}
