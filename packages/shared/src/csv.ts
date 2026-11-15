const PLAIN_NEGATIVE_NUMBER = /^-(?:\d+(?:\.\d*)?|\.\d+)$/u;

function startsLikeFormula(value: string): boolean {
  const rest = value.replace(/^'*[ \t\u00A0]*/u, "");
  const first = rest.charAt(0);
  if (first === "=" || first === "+" || first === "@") {
    return true;
  }
  return first === "-" && !PLAIN_NEGATIVE_NUMBER.test(rest);
}

export function escapeCsvField(value: string): string {
  const safe = startsLikeFormula(value) ? `'${value}` : value;
  if (/[",\n\r]/u.test(safe)) {
    return `"${safe.replaceAll('"', '""')}"`;
  }
  return safe;
}

export function unescapeCsvField(value: string): string {
  return value.startsWith("'") && startsLikeFormula(value.slice(1)) ? value.slice(1) : value;
}
