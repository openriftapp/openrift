export function rulesTeaser(text: string, max: number): string {
  const plain = text
    .replaceAll(/:rb_[a-z0-9_]+:/gu, "")
    .replaceAll(/[[\]_]/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();
  if (plain.length <= max) {
    return plain;
  }
  let teaser = "";
  for (const word of plain.split(" ")) {
    const next = teaser ? `${teaser} ${word}` : word;
    if (next.length > max - 1) {
      break;
    }
    teaser = next;
  }
  return `${teaser || plain.slice(0, max - 1)}…`;
}
