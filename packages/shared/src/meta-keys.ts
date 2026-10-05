import { slugifyName } from "./strings.js";

// Always append cardSlug, even for a champion with only one legend: a later
// second variant would otherwise break the existing /meta/legends/<slug> link.
export function metaLegendSlug(displayName: string, cardSlug: string): string {
  const comma = displayName.indexOf(", ");
  if (comma === -1) {
    return cardSlug;
  }
  return `${slugifyName(displayName.slice(0, comma))}-${cardSlug}`;
}

// The `#n` suffix on a playloltcg identity only disambiguates two same-named
// entrants of one event, so it's folded away for the player's page.
export function metaPlayerKey(sourceIdentity: string | null): string | null {
  if (sourceIdentity === null || sourceIdentity === "") {
    return null;
  }
  return sourceIdentity.replace(/#\d+$/u, "");
}
