import { imageUrl } from "@openrift/shared/image-url";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { InitResponse } from "@openrift/shared/types/api/init";
import type { MarketplaceInfoResponse, PricesResponse } from "@openrift/shared/types/api/pricing";
import type { RulesListResponse, RuleVersionResponse } from "@openrift/shared/types/api/rules";
import type {
  ArtVariant,
  CardFace,
  CardSize,
  CardType,
  Finish,
  Rarity,
} from "@openrift/shared/types/enums";
import type { Insertable } from "kysely";

import type { Database } from "./tables.js";

type Row<T extends keyof Database> = Insertable<Database[T]>;

type SlugReferenceTable =
  | "cardTypes"
  | "rarities"
  | "domains"
  | "superTypes"
  | "finishes"
  | "artVariants"
  | "cardSizes"
  | "deckFormats"
  | "deckZones"
  | "conditions"
  | "graders";

interface SlugReferenceRow {
  slug: string;
  label: string;
  sortOrder: number;
  color?: string | null;
}

export interface CatalogSync {
  slugReferences: { table: SlugReferenceTable; rows: SlugReferenceRow[] }[];
  languages: Row<"languages">[];
  formats: Row<"formats">[];
  keywords: Row<"keywords">[];
  keywordTranslations: Row<"keywordTranslations">[];
  markers: Row<"markers">[];
  distributionChannels: (Omit<Row<"distributionChannels">, "parentId"> & {
    parentSlug: string | null;
  })[];
  tagCategories: Row<"tagCategories">[];
  tagDefinitions: { tag: string; categorySlug: string }[];
  customTagCategories: Row<"customTagCategories">[];
  customTags: (Omit<Row<"customTags">, "categoryId"> & { categorySlug: string })[];
  sets: Row<"sets">[];
  setReleases: Row<"setReleases">[];
  cards: Row<"cards">[];
  cardDomains: Row<"cardDomains">[];
  cardCardTypes: Row<"cardCardTypes">[];
  cardSuperTypes: Row<"cardSuperTypes">[];
  cardTokens: Row<"cardTokens">[];
  cardErrata: Row<"cardErrata">[];
  cardBans: Row<"cardBans">[];
  cardCustomTags: { cardId: string; customTagSlug: string }[];
  imageFiles: Row<"imageFiles">[];
  printings: Row<"printings">[];
  printingImages: Row<"printingImages">[];
  printingMarkers: { printingId: string; markerSlug: string }[];
  printingDistributionChannels: {
    printingId: string;
    channelSlug: string;
    distributionNote: string | null;
  }[];
  printingCitations: Row<"printingCitations">[];
}

function rehostedUrl(imageId: string): string {
  return imageUrl(imageId, "full").replace(/-full\.webp$/u, "");
}

function parentsFirst<T extends { id: string; parentId: string | null }>(items: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  const visit = (item: T) => {
    if (seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    const parent = item.parentId === null ? undefined : byId.get(item.parentId);
    if (parent) {
      visit(parent);
    }
    ordered.push(item);
  };
  for (const item of items) {
    visit(item);
  }
  return ordered;
}

export function buildCatalogSync(init: InitResponse, catalog: CatalogResponse): CatalogSync {
  const { enums } = init;
  const slugReferences: CatalogSync["slugReferences"] = [
    { table: "cardTypes", rows: enums.cardTypes },
    { table: "rarities", rows: enums.rarities },
    { table: "domains", rows: enums.domains },
    { table: "superTypes", rows: enums.superTypes },
    { table: "finishes", rows: enums.finishes },
    { table: "artVariants", rows: enums.artVariants },
    { table: "cardSizes", rows: enums.cardSizes },
    { table: "deckFormats", rows: enums.deckFormats },
    { table: "deckZones", rows: enums.deckZones },
    { table: "conditions", rows: enums.conditions },
    { table: "graders", rows: enums.graders },
  ];

  const cards = Object.entries(catalog.cards);
  const printings = Object.entries(catalog.printings);
  const customTagsBySlug = new Map(init.customTags.map((tag) => [tag.slug, tag]));
  const customTagCategories = new Map<string, Row<"customTagCategories">>();
  for (const tag of init.customTags) {
    if (!customTagCategories.has(tag.category)) {
      customTagCategories.set(tag.category, {
        slug: tag.category,
        label: tag.categoryLabel,
        sortOrder: customTagCategories.size,
      });
    }
  }

  const formats = new Map<string, Row<"formats">>();
  for (const [, card] of cards) {
    for (const ban of card.bans) {
      formats.set(ban.formatId, { id: ban.formatId, name: ban.formatName });
    }
  }

  const imageFiles = new Map<string, Row<"imageFiles">>();
  const addImageFile = (id: string, credit?: string) => {
    if (!imageFiles.has(id)) {
      imageFiles.set(id, { id, rehostedUrl: rehostedUrl(id), credit: credit ?? null });
    }
  };
  for (const [, printing] of printings) {
    for (const image of printing.images) {
      addImageFile(image.imageId, image.credit);
    }
    if (printing.fallbackImageId !== undefined) {
      addImageFile(printing.fallbackImageId);
    }
  }

  return {
    slugReferences,
    languages: enums.languages.map((language) => ({
      code: language.slug,
      name: language.label,
      sortOrder: language.sortOrder,
      color: language.color,
    })),
    formats: [...formats.values()],
    keywords: Object.entries(init.keywords).map(([name, keyword]) => ({
      name,
      color: keyword.color,
      darkText: keyword.darkText,
      costKeyword: keyword.costKeyword,
      cardModifier: keyword.cardModifier,
    })),
    keywordTranslations: Object.entries(init.keywords).flatMap(([name, keyword]) =>
      Object.entries(keyword.translations ?? {}).map(([language, label]) => ({
        keywordName: name,
        language,
        label,
      })),
    ),
    markers: enums.markers.map((marker) => ({
      slug: marker.slug,
      label: marker.label,
      description: marker.description,
      sortOrder: marker.sortOrder,
    })),
    distributionChannels: parentsFirst(init.distributionChannels).map((channel, index) => ({
      id: channel.id,
      slug: channel.slug,
      label: channel.label,
      description: channel.description,
      kind: channel.kind,
      childrenLabel: channel.childrenLabel,
      sortOrder: index,
      parentSlug:
        init.distributionChannels.find((parent) => parent.id === channel.parentId)?.slug ?? null,
    })),
    tagCategories: init.tagCategories.map((category) => ({
      slug: category.slug,
      label: category.label,
      sortOrder: category.sortOrder,
    })),
    tagDefinitions: Object.entries(init.tagCategoryMap).map(([tag, categorySlug]) => ({
      tag,
      categorySlug,
    })),
    customTagCategories: [...customTagCategories.values()],
    customTags: init.customTags.map((tag) => ({
      id: tag.id,
      slug: tag.slug,
      label: tag.label,
      description: tag.description,
      sortOrder: tag.sortOrder,
      categorySlug: tag.category,
    })),
    sets: catalog.sets.map((set, index) => ({
      id: set.id,
      slug: set.slug,
      name: set.name,
      setType: set.setType,
      sortOrder: index,
    })),
    setReleases: catalog.sets.flatMap((set) =>
      Object.entries(set.releases).map(([language, release]) => ({
        setId: set.id,
        language,
        releasedAt: release.releasedAt,
        precision: release.precision,
      })),
    ),
    cards: cards.map(([id, card]) => ({
      id,
      slug: card.slug,
      name: card.name,
      type: card.type as CardType,
      might: card.might,
      energy: card.energy,
      power: card.power,
      mightBonus: card.mightBonus,
      keywords: card.keywords,
      tags: card.tags,
      maxCopiesOverride: card.maxCopiesOverride,
      additionalLegendCount: card.additionalLegendCount,
    })),
    cardDomains: cards.flatMap(([cardId, card]) =>
      card.domains.map((domainSlug, ordinal) => ({ cardId, domainSlug, ordinal })),
    ),
    cardCardTypes: cards.flatMap(([cardId, card]) =>
      card.types.map((typeSlug, position) => ({ cardId, typeSlug, position })),
    ),
    cardSuperTypes: cards.flatMap(([cardId, card]) =>
      card.superTypes.map((superTypeSlug) => ({ cardId, superTypeSlug })),
    ),
    cardTokens: cards.flatMap(([cardId, card]) =>
      card.tokenCardIds.map((tokenCardId) => ({ cardId, tokenCardId })),
    ),
    // The payload drops the announcement link, so announced errata land as sourced rows.
    cardErrata: cards.flatMap(([cardId, card]) =>
      card.errata
        ? [
            {
              cardId,
              correctedRulesText: card.errata.correctedRulesText,
              correctedEffectText: card.errata.correctedEffectText,
              source: card.errata.source,
              sourceUrl: card.errata.sourceUrl,
              effectiveDate: card.errata.effectiveDate,
            },
          ]
        : [],
    ),
    cardBans: cards.flatMap(([cardId, card]) =>
      card.bans.map((ban) => ({
        cardId,
        formatId: ban.formatId,
        bannedAt: ban.bannedAt,
        reason: ban.reason,
      })),
    ),
    cardCustomTags: Object.entries(catalog.customTagAssignments).flatMap(([cardId, slugs]) =>
      slugs
        .filter((slug) => customTagsBySlug.has(slug))
        .map((customTagSlug) => ({ cardId, customTagSlug })),
    ),
    imageFiles: [...imageFiles.values()],
    printings: printings.map(([id, printing]) => ({
      id,
      cardId: printing.cardId,
      setId: printing.setId,
      shortCode: printing.shortCode,
      rarity: printing.rarity as Rarity,
      artVariant: printing.artVariant as ArtVariant,
      isSigned: printing.isSigned,
      isOvernumbered: printing.isOvernumbered,
      markerSlugs: printing.markers.map((marker) => marker.slug),
      finish: printing.finish as Finish,
      size: printing.size as CardSize,
      artist: printing.artist,
      publicCode: printing.publicCode,
      printedRulesText: printing.printedRulesText,
      printedEffectText: printing.printedEffectText,
      flavorText: printing.flavorText,
      printedName: printing.printedName,
      printedYear: printing.printedYear,
      language: printing.language,
      comment: printing.comment,
      fallbackArtMode: printing.fallbackArtMode ?? "auto",
      fallbackImageFileId: printing.fallbackImageId ?? null,
    })),
    printingImages: printings.flatMap(([printingId, printing]) =>
      printing.images.map((image) => ({
        printingId,
        imageFileId: image.imageId,
        face: image.face as CardFace,
        isActive: true,
      })),
    ),
    printingMarkers: printings.flatMap(([printingId, printing]) =>
      printing.markers.map((marker) => ({ printingId, markerSlug: marker.slug })),
    ),
    printingDistributionChannels: printings.flatMap(([printingId, printing]) =>
      printing.distributionChannels.map((entry) => ({
        printingId,
        channelSlug: entry.channel.slug,
        distributionNote: entry.distributionNote,
      })),
    ),
    printingCitations: printings.flatMap(([printingId, printing]) =>
      (printing.citations ?? []).map((citation, sortOrder) => ({
        id: citation.id,
        printingId,
        label: citation.label,
        sourceUrl: citation.sourceUrl,
        sortOrder,
      })),
    ),
  };
}

export interface RulesSync {
  ruleVersions: Row<"ruleVersions">[];
  rules: Row<"rules">[];
}

export function buildRulesSync(
  versions: readonly RuleVersionResponse[],
  lists: readonly RulesListResponse[],
): RulesSync {
  return {
    ruleVersions: versions.map((version) => ({
      kind: version.kind,
      language: version.language,
      version: version.version,
      comments: version.comments,
      label: version.label,
      documentVersion: version.documentVersion,
      importedAt: new Date(version.importedAt),
    })),
    rules: lists.flatMap((list) =>
      list.rules.map((rule) => ({
        id: rule.id,
        kind: rule.kind,
        language: rule.language,
        version: rule.version,
        ruleNumber: rule.ruleNumber,
        sortOrder: rule.sortOrder,
        depth: rule.depth,
        ruleType: rule.ruleType,
        content: rule.content,
        changeType: rule.changeType,
      })),
    ),
  };
}

const MARKETPLACES = ["tcgplayer", "cardmarket", "cardtrader", "cardnexus"] as const;

// mv_daily_printing_prices reads market cents for these and low cents for the rest.
const MARKET_HEADLINE = new Set<string>(["tcgplayer", "cardnexus"]);

const DAY_MS = 86_400_000;

const SYNC_GROUP_ID = 0;

export interface PricesSync {
  groups: Row<"marketplaceGroups">[];
  products: (Omit<Row<"marketplaceProducts">, "id"> & { skuKey: string })[];
  variants: { skuKey: string; printingId: string }[];
  prices: (Omit<Row<"marketplaceProductPrices">, "marketplaceProductId"> & { skuKey: string })[];
}

export function buildPricesSync(
  prices: PricesResponse,
  infos: MarketplaceInfoResponse["infos"],
  catalog: CatalogResponse,
  today: Date,
): PricesSync {
  const products = new Map<string, PricesSync["products"][number]>();
  const priceRows = new Map<string, PricesSync["prices"][number]>();
  const variants: PricesSync["variants"] = [];

  for (const [printingId, byMarketplace] of Object.entries(prices.prices)) {
    const printing = catalog.printings[printingId];
    const info = infos[printingId];
    if (!printing || !info) {
      continue;
    }
    const card = catalog.cards[printing.cardId];
    for (const marketplace of MARKETPLACES) {
      const cents = byMarketplace[marketplace];
      const externalId = info[marketplace].productId;
      if (cents === undefined || externalId === null) {
        continue;
      }
      const skuKey = `${marketplace}|${externalId}|${printing.finish}|${printing.language}`;
      if (!products.has(skuKey)) {
        products.set(skuKey, {
          skuKey,
          marketplace,
          externalId,
          groupId: SYNC_GROUP_ID,
          productName: card?.name ?? printing.shortCode,
          finish: printing.finish,
          language: printing.language,
        });
        const staleDays = prices.stale[printingId]?.[marketplace] ?? 0;
        priceRows.set(skuKey, {
          skuKey,
          recordedAt: new Date(today.getTime() - staleDays * DAY_MS),
          ...(MARKET_HEADLINE.has(marketplace) ? { marketCents: cents } : { lowCents: cents }),
        });
      }
      variants.push({ skuKey, printingId });
    }
  }

  const marketplaces = new Set([...products.values()].map((product) => product.marketplace));
  return {
    groups: [...marketplaces].map((marketplace) => ({
      marketplace,
      groupId: SYNC_GROUP_ID,
      name: "Synced prices",
    })),
    products: [...products.values()],
    variants,
    prices: [...priceRows.values()],
  };
}
