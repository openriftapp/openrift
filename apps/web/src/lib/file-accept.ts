/** Applies an `<input accept>` list (`.png`, `image/*`, `image/webp`) to a file; no list accepts everything. */
export function matchesAccept(file: Pick<File, "name" | "type">, accept?: string): boolean {
  const patterns = (accept ?? "")
    .split(",")
    .map((pattern) => pattern.trim().toLowerCase())
    .filter((pattern) => pattern !== "");
  if (patterns.length === 0) {
    return true;
  }
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return patterns.some((pattern) => {
    if (pattern.startsWith(".")) {
      return name.endsWith(pattern);
    }
    if (pattern.endsWith("/*")) {
      return type.startsWith(pattern.slice(0, -1));
    }
    return type === pattern;
  });
}
