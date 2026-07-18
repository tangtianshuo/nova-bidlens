/**
 * Converts a camelCase string to snake_case.
 */
export function camelToSnake(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converts a snake_case string to camelCase.
 */
export function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively converts all keys in an object from camelCase to snake_case.
 */
export function toSnakeCase<T>(obj: T): unknown {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[camelToSnake(key)] = toSnakeCase(value);
    }
    return result;
  }
  return obj;
}

/**
 * Recursively converts all keys in an object from snake_case to camelCase.
 */
export function toCamelCase<T>(obj: T): unknown {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[snakeToCamel(key)] = toCamelCase(value);
    }
    return result;
  }
  return obj;
}
