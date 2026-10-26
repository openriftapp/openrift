import { imageUrl } from "@openrift/shared/image-url";
import type { CatalogPrintingSideValue, CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { InitResponse } from "@openrift/shared/types/api/init";
import type { MarketplaceInfoResponse, PricesResponse } from "@openrift/shared/types/api/pricing";
import type { RulesListResponse, RuleVersionResponse } from "@openrift/shared/types/api/rules";
import type { ArtVariant, CardSize, CardType, Finish, Rarity } from "@openrift/shared/types/enums";
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
  sets: Row<"sets">[];
  setReleases: Row<"setReleases">[];
  cards: Row<"cards">[];
  cardDomains: Row<"cardDomains">[];
  cardCardTypes: Row<"cardCardTypes">[];
  cardSuperTypes: Row<"cardSuperTypes">[];
  cardTokens: Row<"cardTokens">[];
  cardErrata: Row<"cardErrata">[];
  cardBans: Row<"cardBans">[];
  imageFiles: Row<"imageFiles">[];
  faces: Row<"faces">[];
  faceImages: Row<"faceImages">[];
  printings: Row<"printings">[];
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
  // A payload without face ids comes from an API that predates them; printings sharing a printed
  // identity share one face then, keyed by the first such printing, standard size first.
  const face1IdByPrinting = new Map<string, string>();
  const faceIdByIdentity = new Map<string, string>();
  for (const [printingId, printing] of printings.toSorted(
    ([idA, a], [idB, b]) =>
      Number(b.size === "standard") - Number(a.size === "standard") || idA.localeCompare(idB),
  )) {
    if (printing.faceId !== undefined || printing.side2 !== undefined) {
      face1IdByPrinting.set(printingId, printing.faceId ?? printingId);
      continue;
    }
    const identity = JSON.stringify([
      printing.cardId,
      printing.shortCode,
      printing.finish,
      printing.markers.toSorted(),
      printing.language,
    ]);
    const faceId = faceIdByIdentity.get(identity) ?? printingId;
    faceIdByIdentity.set(identity, faceId);
    face1IdByPrinting.set(printingId, faceId);
  }
  const sides: CatalogPrintingSideValue[] = printings.flatMap(
    ([printingId, { side2, faceId: _faceId, ...printing }]) => [
      { ...printing, faceId: face1IdByPrinting.get(printingId) ?? printingId },
      ...(side2 === undefined ? [] : [side2]),
    ],
  );
  const faceSides = [...new Map(sides.map((side) => [side.faceId, side])).values()];
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
  for (const face of sides) {
    for (const image of face.images) {
      addImageFile(image.imageId, image.credit);
    }
    if (face.fallbackImageId !== undefined) {
      addImageFile(face.fallbackImageId);
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
    imageFiles: [...imageFiles.values()],
    faces: faceSides.map((printing) => ({
      id: printing.faceId,
      cardId: printing.cardId,
      setId: printing.setId,
      shortCode: printing.shortCode,
      rarity: printing.rarity as Rarity,
      artVariant: printing.artVariant as ArtVariant,
      isSigned: printing.isSigned,
      isOvernumbered: printing.isOvernumbered,
      markerSlugs: printing.markers,
      finish: printing.finish as Finish,
      artist: printing.artist,
      publicCode: printing.publicCode,
      printedRulesText: printing.printedRulesText,
      printedEffectText: printing.printedEffectText,
      flavorText: printing.flavorText,
      printedName: printing.printedName,
      printedYear: printing.printedYear,
      language: printing.language,
      fallbackArtMode: printing.fallbackArtMode ?? "auto",
      fallbackImageFileId: printing.fallbackImageId ?? null,
    })),
    faceImages: faceSides.flatMap((face) =>
      face.images.map((image) => ({
        faceId: face.faceId,
        imageFileId: image.imageId,
        isActive: true,
      })),
    ),
    printings: printings.map(([id, printing]) => ({
      id,
      face1Id: face1IdByPrinting.get(id) ?? id,
      face2Id: printing.side2?.faceId ?? null,
      size: printing.size as CardSize,
      comment: printing.comment,
    })),
    printingDistributionChannels: printings.flatMap(([printingId, printing]) =>
      printing.distributionChannels.map((entry) => ({
        printingId,
        channelSlug: entry.channel,
        distributionNote: entry.note ?? null,
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
        priceRows.set(skuKey, {
          skuKey,
          recordedAt: today,
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
