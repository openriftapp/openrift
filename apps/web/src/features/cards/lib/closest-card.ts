import type { CardSearchIndex, SearchableCard } from "@openrift/shared/card-search";
import { resolveCard } from "@openrift/shared/card-search";
import { squashForSearch } from "@openrift/shared/search-fold";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 64;

export function slugToSearchText(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Malformed percent-encoding: the raw slug still reads as words.
  }
  return decoded.replaceAll(/[-_+\s]+/gu, " ").trim();
}

function allowedEdits(length: number): number {
  if (length < 5) {
    return 0;
  }
  return length <= 10 ? 1 : 2;
}

/** Optimal string alignment distance, or `limit + 1` once it is certain to exceed `limit`. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) {
    return limit + 1;
  }
  let beforePrevious: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, (beforePrevious[j - 2] ?? 0) + 1);
      }
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) {
      return limit + 1;
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length] ?? limit + 1;
}

/** `resolveCard` does no fuzzy matching, so typos fall through to a bounded edit distance. */
export function closestCard<TCard extends SearchableCard>(
  index: CardSearchIndex<TCard>,
  query: string,
): TCard | undefined {
  const squashed = squashForSearch(query);
  if (squashed.length < MIN_QUERY_LENGTH || squashed.length > MAX_QUERY_LENGTH) {
    return undefined;
  }
  const resolution = resolveCard(index, query);
  if (resolution.status === "matched") {
    return resolution.card;
  }

  const limit = allowedEdits(squashed.length);
  if (limit === 0) {
    return undefined;
  }
  let best: TCard | undefined;
  let bestDistance = limit + 1;
  let tied = false;
  for (const entry of index.entries) {
    const distance = Math.min(
      editDistance(squashed, squashForSearch(entry.card.slug), limit),
      ...entry.names.map((name) => editDistance(squashed, name.squashed, limit)),
    );
    if (distance < bestDistance) {
      best = entry.card;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance && distance <= limit && entry.card.id !== best?.id) {
      tied = true;
    }
  }
  return bestDistance <= limit && !tied ? best : undefined;
}
