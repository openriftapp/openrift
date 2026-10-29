import type { Printing } from "../types/catalog.js";
import type { SearchVocabulary } from "./bind.js";
import { formatSearchSlug } from "./keys.js";

interface VocabularySource {
  printings: readonly Printing[];
  sets: readonly { slug: string; name: string }[];
  formats?: readonly { id: string; name: string }[];
  enums?: {
    domains?: readonly { slug: string }[];
    rarities?: readonly { slug: string }[];
    languages?: readonly { slug: string }[];
    markers?: readonly { slug: string }[];
    channels?: readonly { slug: string }[];
  };
}

// Keyed by the sets array, which stays the same object for one catalog while the
// printings array is re-sorted per viewer.
const CACHE = new WeakMap<
  readonly { slug: string; name: string }[],
  { size: number; formats: string; vocabulary: SearchVocabulary }
>();

function formatsKey(formats: VocabularySource["formats"]): string {
  return formats?.map((format) => `${format.id}=${format.name}`).join("|") ?? "";
}

export function catalogSearchVocabulary(source: VocabularySource): SearchVocabulary {
  const cached = CACHE.get(source.sets);
  const formatsCacheKey = formatsKey(source.formats);
  if (cached && cached.size === source.printings.length && cached.formats === formatsCacheKey) {
    return cached.vocabulary;
  }
  const slugs = (rows?: readonly { slug: string }[]) => rows?.map((row) => row.slug) ?? [];
  const domains = new Set<string>(slugs(source.enums?.domains));
  const rarities = new Set<string>(slugs(source.enums?.rarities));
  const languages = new Set<string>(slugs(source.enums?.languages));
  const markers = new Set<string>(slugs(source.enums?.markers));
  const channels = new Set<string>(slugs(source.enums?.channels));
  for (const printing of source.printings) {
    for (const domain of printing.card.domains) {
      domains.add(domain);
    }
    rarities.add(printing.rarity);
    languages.add(printing.language);
    for (const marker of printing.markers) {
      markers.add(marker.slug);
    }
    for (const entry of printing.distributionChannels) {
      channels.add(entry.channel.slug);
    }
  }
  const sets = source.sets.map((set) => ({ value: set.slug, names: [set.name] }));
  const formats = source.formats?.map((format) => ({
    value: format.id,
    names: [formatSearchSlug(format.name)],
  }));
  const vocabulary: SearchVocabulary = {
    domain: [...domains],
    rarity: [...rarities],
    set: sets,
    lang: [...languages],
    in: [...sets, ...languages],
    marker: [...markers],
    channel: [...channels],
    ...(formats ? { format: formats, banned: formats } : {}),
  };
  CACHE.set(source.sets, {
    size: source.printings.length,
    formats: formatsCacheKey,
    vocabulary,
  });
  return vocabulary;
}
