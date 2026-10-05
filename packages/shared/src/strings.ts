export function slugifyName(name: string, options?: { foldDiacritics?: boolean }): string {
  const source = options?.foldDiacritics ? name.normalize("NFKD").replaceAll(/\p{M}+/gu, "") : name;
  return source
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/-{2,}/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

export function straightenApostrophes(text: string): string {
  return text.replaceAll("’", "'");
}

export function emptyToNull(value: string | null | undefined): string | null {
  return value || null;
}

export function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function capitalize(word: string): string {
  return word.slice(0, 1).toUpperCase() + word.slice(1);
}

// Reference-table slugs use `-`; a few legacy ones use `_`.
const SLUG_SEPARATORS = /[-_]/u;

export function sentenceCaseSlug(slug: string): string {
  return capitalize(slug.split(SLUG_SEPARATORS).filter(Boolean).join(" "));
}

export function titleCaseSlug(slug: string): string {
  return slug
    .split(SLUG_SEPARATORS)
    .filter(Boolean)
    .map((word) => capitalize(word))
    .join(" ");
}

// The ellipsis itself counts toward `max`.
export function truncateWithEllipsis(text: string, max: number): string {
  if (max <= 0) {
    return "";
  }
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  return JSON.stringify(value) ?? "";
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function toError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(stringifyUnknown(thrown));
}

export function errorMessage(thrown: unknown): string {
  return thrown instanceof Error ? thrown.message : stringifyUnknown(thrown);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
