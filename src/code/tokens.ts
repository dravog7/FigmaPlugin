import { cleanValue } from './utils';

type TokenEntry = {
  key: string;
  name: string;
  type: VariableResolvedDataType;
  value: unknown;
};

export async function collectTokens(): Promise<TokenEntry[]> {
  const variables = await figma.variables.getLocalVariablesAsync();

  return variables.map((variable) => ({
    key: variable.key,
    name: variable.name,
    type: variable.resolvedType,
    value: cleanValue(variable.valuesByMode)
  }));
}
