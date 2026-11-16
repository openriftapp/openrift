function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function definedKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record).filter((key) => record[key] !== undefined);
}

/** Deep equality as the values would serialize to JSON: an `undefined` property counts as absent. */
export function jsonValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => jsonValuesEqual(item, b[index]))
    );
  }
  if (!isPlainRecord(a) || !isPlainRecord(b)) {
    return false;
  }
  const keys = definedKeys(a);
  return (
    keys.length === definedKeys(b).length &&
    keys.every((key) => b[key] !== undefined && jsonValuesEqual(a[key], b[key]))
  );
}
