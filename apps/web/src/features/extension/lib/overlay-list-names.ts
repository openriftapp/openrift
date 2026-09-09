const NAMED_LIMIT = 3;

export function summarizeListNames(names: readonly string[]): string {
  if (names.length > NAMED_LIMIT) {
    const rest = names.length - NAMED_LIMIT;
    return `${names.slice(0, NAMED_LIMIT).join(", ")} and ${rest} more`;
  }
  if (names.length > 1) {
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
  }
  return names.at(0) ?? "";
}
