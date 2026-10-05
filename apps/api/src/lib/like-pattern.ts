/** Postgres LIKE's default escape character is the backslash. */
function escapeLike(value: string): string {
  return value.replaceAll(/[\\%_]/gu, String.raw`\$&`);
}

export function containsPattern(term: string): string {
  return `%${escapeLike(term)}%`;
}

export function startsWithPattern(prefix: string): string {
  return `${escapeLike(prefix)}%`;
}
