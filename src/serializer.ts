import { cleanValue } from './utils';

type JsonMap = Record<string, unknown>;

type VariableLookup = {
  byId: Record<string, JsonMap>;
};

const LAYOUT_FIELDS = [
  'layoutMode',
  'layoutPositioning',
  'primaryAxisSizingMode',
  'counterAxisSizingMode',
  'layoutWrap',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'strokesIncludedInLayout',
  'constraints'
] as const;

const TEXT_SEGMENT_FIELDS = [
  'characters',
  'fontName',
  'fontSize',
  'fontWeight',
  'textCase',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationColor',
  'textDecorationOffset',
  'textDecorationSkipInk',
  'textDecorationLineType',
  'lineHeight',
  'letterSpacing',
  'fills',
  'textStyleId',
  'fillStyleId',
  'listOptions',
  'indentation',
  'paragraphSpacing',
  'paragraphIndent',
  'hyperlink',
  'boundVariables'
] as const;

function getNodeBasics(node: SceneNode): JsonMap {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    visible: node.visible,
    locked: node.locked
  };
}

async function getStructuralSnapshot(node: SceneNode): Promise<unknown> {
  if (!('exportAsync' in node)) {
    return null;
  }

  try {
    const snapshot = await (node as SceneNode & {
      exportAsync(options: { format: string }): Promise<unknown>;
    }).exportAsync({ format: 'JSON_REST_V1' });
    return cleanValue(snapshot);
  } catch {
    return null;
  }
}

async function getCssSnapshot(node: SceneNode): Promise<unknown> {
  if (!('getCSSAsync' in node)) {
    return null;
  }

  try {
    const css = await (node as SceneNode & {
      getCSSAsync(): Promise<unknown>;
    }).getCSSAsync();
    return cleanValue(css);
  } catch {
    return null;
  }
}

function getLayoutSemantics(node: SceneNode): JsonMap | null {
  const layout: JsonMap = {};

  for (const field of LAYOUT_FIELDS) {
    if (field in node) {
      layout[field] = cleanValue((node as unknown as JsonMap)[field]);
    }
  }

  return Object.keys(layout).length ? layout : null;
}

async function getTextSegments(node: SceneNode): Promise<unknown> {
  if (node.type !== 'TEXT') {
    return null;
  }

  try {
    const segments = await node.getStyledTextSegments(TEXT_SEGMENT_FIELDS as unknown as StyledTextSegmentFields[]);
    return cleanValue(segments);
  } catch {
    return null;
  }
}

function collectVariableAliasIds(value: unknown, into: Set<string>) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectVariableAliasIds(item, into);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const candidate = value as { type?: string; id?: string };
  if (candidate.type === 'VARIABLE_ALIAS' && typeof candidate.id === 'string') {
    into.add(candidate.id);
  }

  for (const nestedValue of Object.values(value as JsonMap)) {
    collectVariableAliasIds(nestedValue, into);
  }
}

async function hydrateVariableLookup(aliasIds: Set<string>): Promise<VariableLookup> {
  const byId: Record<string, JsonMap> = {};

  for (const aliasId of aliasIds) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(aliasId);
      if (!variable) {
        continue;
      }

      byId[aliasId] = cleanValue({
        id: variable.id,
        name: variable.name,
        key: variable.key,
        resolvedType: variable.resolvedType,
        variableCollectionId: variable.variableCollectionId,
        valuesByMode: variable.valuesByMode,
        scopes: variable.scopes,
        hiddenFromPublishing: variable.hiddenFromPublishing,
        remote: variable.remote
      }) as JsonMap;
    } catch {
      // Continue when variable ids are stale or inaccessible.
    }
  }

  return { byId };
}

async function getTokenData(node: SceneNode): Promise<JsonMap | null> {
  if (!('boundVariables' in node)) {
    return null;
  }

  const boundVariables = cleanValue((node as SceneNode & { boundVariables?: unknown }).boundVariables);
  if (!boundVariables) {
    return null;
  }

  const aliasIds = new Set<string>();
  collectVariableAliasIds(boundVariables, aliasIds);
  const variables = await hydrateVariableLookup(aliasIds);

  return {
    boundVariables,
    variables
  };
}

export async function serializeNode(node: SceneNode): Promise<JsonMap> {
  const [structuralSnapshot, inspectCss, textSegments, tokens] = await Promise.all([
    getStructuralSnapshot(node),
    getCssSnapshot(node),
    getTextSegments(node),
    getTokenData(node)
  ]);

  const serialized: JsonMap = {
    node: getNodeBasics(node),
    structuralSnapshot,
    inspectCss,
    layout: getLayoutSemantics(node),
    text: textSegments,
    interactions: cleanValue(('reactions' in node ? node.reactions : null) as unknown),
    tokens
  };

  if ('children' in node) {
    serialized.children = await Promise.all(node.children.map((child) => serializeNode(child)));
  }

  return serialized;
}
