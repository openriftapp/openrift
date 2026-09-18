import { RESERVED_META_EVENT_SLUGS } from "@openrift/shared/contracts/admin/meta-events";
import { slugifyName } from "@openrift/shared/utils";

const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 50;

const SLUG_FALLBACK_STEM = "event";

const RESERVED_SLUGS = new Set(RESERVED_META_EVENT_SLUGS);

function trimHyphens(text: string): string {
  return text.replaceAll(/^-+|-+$/gu, "");
}

function withSuffix(stem: string, suffix: string): string {
  const trimmed = trimHyphens(stem.slice(0, MAX_SLUG_LENGTH - suffix.length));
  return `${trimmed === "" ? SLUG_FALLBACK_STEM : trimmed}${suffix}`;
}

function slugParts(name: string, eventDate: string): { stem: string; suffix: string } {
  const date = /^\d{4}-\d{2}-\d{2}/u.exec(eventDate)?.[0];
  const year = /^\d{4}/u.exec(eventDate)?.[0] ?? "";
  const slugified = slugifyName(name);
  const endsWithYear = year !== "" && (slugified === year || slugified.endsWith(`-${year}`));
  const stem = endsWithYear ? slugified.slice(0, -year.length) : slugified;
  if (date !== undefined) {
    return { stem, suffix: `-${date}` };
  }
  return { stem, suffix: year === "" ? "" : `-${year}` };
}

export function metaEventSlugBase(name: string, eventDate: string): string {
  const { stem, suffix } = slugParts(name, eventDate);
  const candidate = withSuffix(stem, suffix);

  // Only reachable for a very short name in a date-less string, e.g. "AB".
  return candidate.length < MIN_SLUG_LENGTH ? `${SLUG_FALLBACK_STEM}${suffix}` : candidate;
}

export function metaEventSlugCandidates(
  name: string,
  eventDate: string,
  ids: readonly string[],
): string[] {
  const { stem, suffix } = slugParts(name, eventDate);
  const slugs = [
    metaEventSlugBase(name, eventDate),
    ...ids.map((id) => withSuffix(stem, `${suffix}-${id}`)),
  ];
  return slugs.filter((slug) => !RESERVED_SLUGS.has(slug) && slug.length >= MIN_SLUG_LENGTH);
}

const MAX_DECK_NAME_LENGTH = 200;

/** Resolves a standing's name the way every read query's `coalesce` does, for callers holding raw columns. */
export function resolvedStandingName(
  standing: { playerName: string | null; uvsgamesPlayerId: number | null },
  displayNames: ReadonlyMap<number, string>,
): string {
  if (standing.playerName !== null) {
    return standing.playerName;
  }
  if (standing.uvsgamesPlayerId === null) {
    return "";
  }
  return displayNames.get(standing.uvsgamesPlayerId) ?? "";
}

/** The legend leads when present; the event name stands in for a list with no legend zone card. */
export function defaultMetaDeckName(
  legendName: string | null,
  playerName: string,
  eventName: string,
): string {
  const lead = legendName === null || legendName === "" ? eventName : legendName;
  const parts = [lead, playerName === "" ? null : `(${playerName})`].filter(Boolean);
  const name = parts.length === 0 ? "Untitled deck" : parts.join(" ");
  return name.slice(0, MAX_DECK_NAME_LENGTH);
}
