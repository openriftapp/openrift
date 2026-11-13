export function auditChange(
  before: Readonly<Record<string, unknown>> | undefined,
  patch: Readonly<Record<string, unknown>>,
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const previous = before?.[key] ?? null;
    if (value === undefined || previous === value) {
      continue;
    }
    oldValues[key] = previous;
    newValues[key] = value;
  }
  return { oldValues, newValues };
}
