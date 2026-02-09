import { cleanValue } from './utils';

type TokenEntry = {
  key: string;
  name: string;
  type: VariableResolvedDataType;
  value: unknown;
};

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

  for (const nested of Object.values(value as Record<string, unknown>)) {
    collectVariableAliasIds(nested, into);
  }
}

async function collectNodeVariableAliasIds(node: SceneNode, into: Set<string>) {
  if ('boundVariables' in node) {
    collectVariableAliasIds((node as SceneNode & { boundVariables?: unknown }).boundVariables, into);
  }

  if (node.type === 'TEXT') {
    try {
      const segments = await node.getStyledTextSegments(['boundVariables']);
      for (const segment of segments) {
        collectVariableAliasIds((segment as Record<string, unknown>).boundVariables, into);
      }
    } catch {
      // Ignore text segment extraction failures and continue.
    }
  }

  if ('children' in node) {
    for (const child of node.children) {
      await collectNodeVariableAliasIds(child, into);
    }
  }
}

export async function collectTokens(selection: ReadonlyArray<SceneNode>): Promise<TokenEntry[]> {
  const variableIds = new Set<string>();

  for (const node of selection) {
    await collectNodeVariableAliasIds(node, variableIds);
  }

  const tokens: TokenEntry[] = [];
  for (const variableId of variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) {
      continue;
    }

    tokens.push({
      key: variable.key,
      name: variable.name,
      type: variable.resolvedType,
      value: cleanValue(variable.valuesByMode)
    });
  }

  return tokens;
}
