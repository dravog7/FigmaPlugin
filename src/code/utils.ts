export function isMixed<T>(value: T | PluginAPI['mixed']): value is PluginAPI['mixed'] {
  return value === figma.mixed;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cleanValue(value: unknown): unknown {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (isMixed(value as PluginAPI['mixed'])) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(cleanValue);
  }

  if (isObject(value)) {
    const cleanedObject: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const cleanedNested = cleanValue(value[key]);
      if (cleanedNested !== undefined) {
        cleanedObject[key] = cleanedNested;
      }
    }
    return cleanedObject;
  }

  return value;
}

export function flat<T>(arr: T[][]): T[] {
  return arr.reduce((acc, val) => acc.concat(val), []);
}
