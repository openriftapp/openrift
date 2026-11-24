import type { TagTranslationRow, tagTranslationsRepo } from "../repositories/tag-translations.js";

interface PositionalPair {
  language: string;
  label: string;
  tag: string;
  count: number;
}

interface TagTranslationConflict {
  language: string;
  label: string;
  tags: string[];
}

const MIN_SIGHTINGS = 2;
const DOMINANCE = 3;

/** A tag wins when seen twice and three times as often as the runner-up; closer calls are conflicts. */
export function pickTagTranslations(pairs: readonly PositionalPair[]): {
  discovered: TagTranslationRow[];
  conflicts: TagTranslationConflict[];
} {
  const byLabel = Map.groupBy(pairs, (pair) => `${pair.language}\0${pair.label}`);
  const discovered: TagTranslationRow[] = [];
  const conflicts: TagTranslationConflict[] = [];
  for (const group of byLabel.values()) {
    const ranked = group.toSorted((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    const [top, second] = ranked;
    if (top === undefined || top.count < MIN_SIGHTINGS) {
      continue;
    }
    if (second !== undefined && top.count < second.count * DOMINANCE) {
      conflicts.push({
        language: top.language,
        label: top.label,
        tags: ranked.map((pair) => pair.tag),
      });
      continue;
    }
    discovered.push({ language: top.language, label: top.label, tag: top.tag });
  }
  return { discovered, conflicts };
}

export async function discoverTagTranslations(repos: {
  tagTranslations: ReturnType<typeof tagTranslationsRepo>;
}): Promise<{ discovered: number; inserted: number; conflicts: TagTranslationConflict[] }> {
  const pairs = await repos.tagTranslations.positionalPairs();
  const { discovered, conflicts } = pickTagTranslations(pairs);
  const inserted = await repos.tagTranslations.bulkInsert(discovered);
  return { discovered: discovered.length, inserted, conflicts };
}
