import { joinCatalogPrintings } from "@openrift/shared/catalog-join";
import type {
  CatalogPrintingsResponse,
  CatalogResponse,
  CatalogResponseCardValue,
  CatalogResponsePrintingValue,
} from "@openrift/shared/types/api/catalog";
import type { Printing } from "@openrift/shared/types/catalog";

import type { Repos } from "../../../deps.js";
import { loadPrintingDecorations, presentPrintingValues } from "../lib/printing-presenters.js";
import { toEnumRows, toKeywordEntries, toTagCategoryMap } from "../lib/reference-presenters.js";

/**
 * Assembles the full catalog (cards, printings, sets and the reference data
 * their slugs name) server-side. One assembly backs both the public `/catalog` route and dynamic list-rule
 * evaluation, which needs a server-side `Printing[]` to run `filterCards`
 * against.
 */
export async function assembleCatalogResponse(repos: Repos): Promise<CatalogResponse> {
  const { catalog, enums, keywords, tagCategories, tagDefinitions } = repos;

  const [
    sets,
    cardRows,
    printingRows,
    imageRows,
    banRows,
    errataRows,
    enumData,
    keywordRows,
    keywordTranslations,
    tagCategoryRows,
    tagDefinitionRows,
  ] = await Promise.all([
    catalog.sets(),
    catalog.cards(),
    catalog.printings(),
    catalog.printingImages(),
    catalog.cardBans(),
    catalog.cardErrata(),
    enums.all(),
    keywords.listAll(),
    keywords.listAllTranslations(),
    tagCategories.listAll(),
    tagDefinitions.listAll(),
  ]);

  const decorations = await loadPrintingDecorations(repos, [
    ...new Set(printingRows.map((p) => p.printingId)),
  ]);

  const bansByCard = Map.groupBy(banRows, (r) => r.cardId);

  const errataByCard = new Map(
    errataRows.map((r) => [
      r.cardId,
      {
        correctedRulesText: r.correctedRulesText,
        correctedEffectText: r.correctedEffectText,
        source: r.source,
        sourceUrl: r.sourceUrl,
        effectiveDate: r.effectiveDate,
      },
    ]),
  );

  const cards: Record<string, CatalogResponseCardValue> = {};
  for (const { id, ...rest } of cardRows) {
    cards[id] = {
      ...rest,
      errata: errataByCard.get(id) ?? null,
      bans: (bansByCard.get(id) ?? []).map((b) => ({
        formatId: b.formatId,
        formatName: b.formatName,
        bannedAt: b.bannedAt,
        reason: b.reason,
      })),
    };
  }

  const printings = presentPrintingValues(printingRows, imageRows, decorations);

  const keywordEntries = toKeywordEntries(keywordRows, keywordTranslations);
  return {
    sets,
    cards,
    printings,
    markers: [...decorations.markerBySlug.values()],
    distributionChannels: decorations.channels,
    enums: {
      cardTypes: toEnumRows(enumData.cardTypes),
      superTypes: toEnumRows(enumData.superTypes),
      domains: toEnumRows(enumData.domains),
      rarities: toEnumRows(enumData.rarities),
      finishes: toEnumRows(enumData.finishes),
      artVariants: toEnumRows(enumData.artVariants),
      cardSizes: toEnumRows(enumData.cardSizes),
      languages: toEnumRows(enumData.languages),
    },
    keywords: Object.fromEntries(
      Object.entries(keywordEntries).map(([name, { color: _color, darkText: _dark, ...entry }]) => [
        name,
        entry,
      ]),
    ),
    tagCategories: toEnumRows(tagCategoryRows),
    tagCategoryMap: toTagCategoryMap(tagDefinitionRows),
  };
}

/**
 * Parses a comma-joined language-code list ("EN,FR") into a normalized set.
 * Printings store uppercase codes, so entries are uppercased. An unknown code
 * is not an error: it simply matches no printing.
 */
export function parseLanguageCodes(csv: string): Set<string> {
  const codes = new Set<string>();
  for (const part of csv.split(",")) {
    const code = part.trim().toUpperCase();
    if (code) {
      codes.add(code);
    }
  }
  return codes;
}

function pickPrintingsByLanguage(
  printings: Record<string, CatalogResponsePrintingValue>,
  keep: (language: string) => boolean,
): Record<string, CatalogResponsePrintingValue> {
  const picked: Record<string, CatalogResponsePrintingValue> = {};
  for (const [id, printing] of Object.entries(printings)) {
    if (keep(printing.language.toUpperCase())) {
      picked[id] = printing;
    }
  }
  return picked;
}

/**
 * The catalog with only the printings in `langs` (see {@link parseLanguageCodes}),
 * everything else whole. Pure, so the memoized assembly is never mutated.
 */
export function filterCatalogByLanguages(
  catalog: CatalogResponse,
  langs?: ReadonlySet<string>,
): CatalogResponse {
  if (!langs) {
    return catalog;
  }
  return {
    ...catalog,
    printings: pickPrintingsByLanguage(catalog.printings, (language) => langs.has(language)),
  };
}

export function catalogPrintingsExcept(
  catalog: CatalogResponse,
  exceptLangs: ReadonlySet<string>,
): CatalogPrintingsResponse {
  return {
    printings: pickPrintingsByLanguage(catalog.printings, (language) => !exceptLangs.has(language)),
  };
}

/**
 * The bundle a dynamic list rule needs to evaluate server-side: the flat
 * `Printing[]` plus the card→custom-tag-slug map. The map is required for
 * any rule filtering on `customTagSlugs` — `filterCards` reads tags only from
 * this lookup, so without it those dimensions silently match nothing.
 */
export interface RuleCatalog {
  printings: Printing[];
  customTagAssignments: Record<string, readonly string[]>;
}

export async function assembleRuleCatalog(repos: Repos): Promise<RuleCatalog> {
  const [response, assignments] = await Promise.all([
    assembleCatalogResponse(repos),
    repos.customTags.assignmentsByCard(),
  ]);
  return {
    printings: joinCatalogPrintings(response),
    customTagAssignments: Object.fromEntries(assignments),
  };
}
