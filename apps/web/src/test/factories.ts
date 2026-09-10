import type { AdminAuditEventResponse } from "@openrift/shared/contracts/admin/audit-events";
import type { CardBanResponse } from "@openrift/shared/contracts/admin/card-bans";
import type {
  CatalogCardRow,
  CatalogSource,
  ReviewQueueItem,
} from "@openrift/shared/contracts/admin/catalog-review";
import type { MissingImagePrinting } from "@openrift/shared/contracts/card-submissions";
import { makeCard, makePrinting } from "@openrift/shared/test-factories";
import type {
  AdminCardDetailResponse,
  AdminCardResponse,
  AdminPrintingImageResponse,
  AdminPrintingMarketplaceMappingResponse,
  AdminPrintingResponse,
  CandidateCardResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
  StagedProductResponse,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
  UnmatchedCardDetailResponse,
} from "@openrift/shared/types/api/admin";
import type { CopyResponse } from "@openrift/shared/types/api/collection";
import type { MetaPlayerDetailResponse, MetaPlayerFinish } from "@openrift/shared/types/api/meta";
import type { PriceLookup } from "@openrift/shared/types/api/pricing";
import type { TradePreference } from "@openrift/shared/types/api/trade-preferences";
import type { Card, CardErrata, Printing } from "@openrift/shared/types/catalog";
import type { CardType, DeckZone, Domain, SuperType } from "@openrift/shared/types/enums";
import type { Marketplace } from "@openrift/shared/types/pricing";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { CardOwnership } from "@/features/decks/lib/deck-ownership-types";
import type { CardViewerItem } from "@/lib/card-viewer-types";

export const EMPTY_TRADE_PREFERENCE: TradePreference = {
  pricePref: null,
  priceAbsoluteCents: null,
  tradeType: null,
};

let idCounter = 0;

function nextId(): string {
  idCounter++;
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, "0")}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function stubCopy(overrides: Partial<CopyResponse> = {}): CopyResponse {
  return {
    id: nextId(),
    printingId: nextId(),
    collectionId: nextId(),
    groupId: null,
    onLoan: false,
    reserved: false,
    condition: null,
    grader: null,
    grade: null,
    notesPublic: null,
    notesPrivate: null,
    isAltered: false,
    links: [],
    ...overrides,
  };
}

/** Adds the web fixtures' generated slug and stat line on top of the shared defaults. */
export function stubCard(overrides: Partial<Card> = {}): Card {
  return makeCard({
    slug: `RB1-${nextId().slice(-3)}`,
    might: 1,
    energy: 1,
    power: 1,
    mightBonus: 0,
    ...overrides,
  });
}

export function stubPrinting(
  overrides: Omit<Partial<Printing>, "card"> & { card?: Partial<Card> } = {},
): Printing {
  // Drawn before the card so a fixture's generated ids stay stable
  // regardless of what the shared defaults do.
  const id = overrides.id ?? nextId();
  const cardId = overrides.cardId ?? nextId();
  const { card: cardOverrides, ...printingOverrides } = overrides;
  const card = stubCard(cardOverrides);
  return makePrinting({
    id,
    cardId,
    shortCode: card.slug,
    setId: nextId(),
    setSlug: "RB1",
    artist: "Test Artist",
    publicCode: card.slug.toLowerCase(),
    ...printingOverrides,
    card,
  });
}

export function stubMissingImagePrinting(
  index: number,
  overrides: Partial<MissingImagePrinting> = {},
): MissingImagePrinting {
  return {
    printingId: `printing-${index}`,
    cardSlug: `card-${index}`,
    cardName: `Card ${index}`,
    setSlug: "ogn",
    setName: "Origins",
    publicCode: `OGN-${index}`,
    finish: "foil",
    language: "DE",
    copies: 2,
    ...overrides,
  };
}

export function stubCardViewerItem(
  overrides: Omit<Partial<Printing>, "card"> & { card?: Partial<Card> } = {},
): CardViewerItem {
  const printing = stubPrinting(overrides);
  return { id: printing.id, printing };
}

/**
 * Prices are major units verbatim, unlike `priceLookupFromMap` which converts
 * wire cents.
 */
export function stubPriceLookup(
  prices: Record<string, Partial<Record<Marketplace, number>>>,
): PriceLookup {
  return {
    get: (printingId, marketplace) => prices[printingId]?.[marketplace],
    has: (printingId) => prices[printingId] !== undefined,
  };
}

export function stubDeckBuilderCard(overrides: Partial<DeckBuilderCard> = {}): DeckBuilderCard {
  const cardType = overrides.cardType ?? overrides.cardTypes?.[0] ?? ("unit" as CardType);
  return {
    cardId: overrides.cardId ?? nextId(),
    zone: "main" as DeckZone,
    quantity: 1,
    preferredPrintingId: null,
    cardName: "Test Card",
    cardType,
    cardTypes: [cardType],
    superTypes: [] as SuperType[],
    domains: [] as Domain[],
    tags: [],
    keywords: [],
    maxCopiesOverride: null,
    banned: false,
    energy: 1,
    might: 1,
    power: 1,
    ...overrides,
  };
}

export function stubCardOwnership(overrides: Partial<CardOwnership> = {}): CardOwnership {
  const name = overrides.cardName ?? "Test Card";
  return {
    cardId: nextId(),
    cardName: name,
    cardSlug: "test-card",
    displayName: name,
    zone: "main",
    needed: 1,
    owned: 0,
    shortfall: 1,
    locked: 0,
    lockedLoaned: 0,
    lockedReserved: 0,
    lockedExcluded: 0,
    borrowed: 0,
    incoming: 0,
    displayPrice: undefined,
    cheapestPrice: undefined,
    cheapestPrinting: undefined,
    displayPrinting: {
      id: nextId(),
      language: "EN",
      shortCode: "OGN-001",
      setId: "set-origins",
      rarity: "common",
      imageId: undefined,
      landscape: false,
    },
    ...overrides,
  };
}

const META_PLAYER_LEGEND: NonNullable<MetaPlayerFinish["legend"]> = {
  cardId: "legend-lux",
  name: "Lux, Lady of Luminosity",
  slug: "lady-of-luminosity",
  imageId: "img-lux",
  domains: ["calm"],
  archiveSlug: "lux-lady-of-luminosity",
};

type MetaPlayerFinishOverrides = Partial<Omit<MetaPlayerFinish, "event">> & {
  event?: Partial<MetaPlayerFinish["event"]>;
};

/** Pass `legend: null` for a row no source named a legend for. */
export function makeMetaPlayerFinish(overrides: MetaPlayerFinishOverrides = {}): MetaPlayerFinish {
  const { event, ...rest } = overrides;
  return {
    playerId: nextId(),
    rank: 1,
    rankIsTier: false,
    wins: 6,
    losses: 1,
    draws: 0,
    shareToken: null,
    listStatus: "none",
    legend: { ...META_PLAYER_LEGEND },
    ...rest,
    event: {
      slug: "summoner-skirmish",
      name: "Summoner Skirmish",
      eventDate: "2026-08-01",
      format: "constructed",
      tier: "local",
      country: "DE",
      playerCount: 64,
      ...event,
    },
  };
}

export function makeMetaPlayerDetail(
  overrides: Partial<MetaPlayerDetailResponse> = {},
): MetaPlayerDetailResponse {
  return {
    key: "pnrenata",
    name: "Renata",
    finishes: [makeMetaPlayerFinish()],
    ...overrides,
  };
}

export function makeReviewQueueItem(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    id: nextId(),
    kind: "correction",
    provider: "usersubmission",
    isContributor: true,
    submitterName: "Renata",
    cardName: "Lux, Lady of Luminosity",
    normName: "lux-lady-of-luminosity",
    cardSlug: "OGN-001",
    candidateCardId: nextId(),
    note: null,
    changedFields: 3,
    uncheckedPrintings: 0,
    newPrintings: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeAdminCard(overrides: Partial<AdminCardResponse> = {}): AdminCardResponse {
  return {
    id: nextId(),
    slug: "OGN-001",
    name: "Lux, Lady of Luminosity",
    types: ["unit"],
    superTypes: [],
    domains: ["calm"],
    might: 3,
    energy: 2,
    power: 1,
    mightBonus: null,
    keywords: [],
    errata: null,
    tags: [],
    maxCopiesOverride: null,
    comment: null,
    ...overrides,
  };
}

export function makeCandidateCard(
  overrides: Partial<CandidateCardResponse> = {},
): CandidateCardResponse {
  return {
    id: nextId(),
    provider: "usersubmission",
    externalId: "ogn-001--2026-09-01--user",
    shortCode: "OGN-001",
    energy: 2,
    power: 1,
    might: 3,
    superTypes: [],
    types: ["unit"],
    name: "Lux, Lady of Luminosity",
    domains: ["calm"],
    rulesText: null,
    effectText: null,
    mightBonus: null,
    tags: [],
    extraData: null,
    checkedAt: null,
    submittedByUserId: nextId(),
    submittedByName: "Renata",
    submissionNote: null,
    ...overrides,
  };
}

export function makeAdminPrinting(
  overrides: Partial<AdminPrintingResponse> = {},
): AdminPrintingResponse {
  return {
    id: nextId(),
    cardId: nextId(),
    setId: "set-origins",
    setName: "Origins",
    setSlug: "ogn",
    shortCode: "OGN-001",
    rarity: "common",
    artVariant: "standard",
    isSigned: false,
    isOvernumbered: false,
    markerSlugs: [],
    distributionChannelSlugs: [],
    finish: "nonfoil",
    size: "standard",
    artist: "Test Artist",
    publicCode: "OGN-001/300",
    printedRulesText: null,
    printedEffectText: null,
    flavorText: null,
    printedName: null,
    printedYear: 2026,
    language: "EN",
    comment: null,
    expectedPrintingId: "OGN-001",
    canonicalRank: 0,
    fallbackArtMode: "auto",
    fallbackImageFileId: null,
    ...overrides,
  };
}

export function makeCandidatePrinting(
  overrides: Partial<CandidatePrintingResponse> = {},
): CandidatePrintingResponse {
  return {
    id: nextId(),
    candidateCardId: nextId(),
    printingId: null,
    shortCode: "OGN-001",
    setId: "set-origins",
    setName: "Origins",
    rarity: "common",
    artVariant: "standard",
    isSigned: false,
    isOvernumbered: false,
    markerSlugs: [],
    distributionChannelSlugs: [],
    finish: "nonfoil",
    size: "standard",
    artist: "Test Artist",
    publicCode: "OGN-001/300",
    printedRulesText: null,
    printedEffectText: null,
    imageUrl: null,
    flavorText: null,
    externalId: "ogn-001",
    extraData: null,
    language: "EN",
    printedName: null,
    printedYear: 2026,
    checkedAt: null,
    ...overrides,
  };
}

export function makeAdminPrintingImage(
  overrides: Partial<AdminPrintingImageResponse> = {},
): AdminPrintingImageResponse {
  return {
    id: nextId(),
    printingId: nextId(),
    imageFileId: nextId(),
    face: "front",
    originalUrl: "https://cdn.example.test/ogn-001.png",
    rehostedUrl: null,
    rotation: 0,
    needsTrim: false,
    quad: null,
    isActive: true,
    ...overrides,
  };
}

export function makeProviderSetting(
  overrides: Partial<ProviderSettingResponse> = {},
): ProviderSettingResponse {
  return {
    provider: "gallery",
    sortOrder: 0,
    isHidden: false,
    isFavorite: false,
    helperReviewable: false,
    ...overrides,
  };
}

export function makeAdminCardDetail(
  overrides: Partial<AdminCardDetailResponse> = {},
): AdminCardDetailResponse {
  const card = overrides.card === undefined ? makeAdminCard() : overrides.card;
  return {
    card,
    displayName: card?.name ?? "Lux, Lady of Luminosity",
    sources: [],
    printings: [],
    candidatePrintings: [],
    candidatePrintingGroups: [],
    expectedCardId: card?.slug ?? "OGN-001",
    printingImages: [],
    setTotals: {},
    marketplaceMappings: [],
    ...overrides,
  };
}

export function makeUnmatchedCardDetail(
  overrides: Partial<UnmatchedCardDetailResponse> = {},
): UnmatchedCardDetailResponse {
  return {
    displayName: "Lux, Lady of Luminosity",
    sources: [],
    candidatePrintings: [],
    candidatePrintingGroups: [],
    defaultCardId: "OGN-001",
    setTotals: {},
    ...overrides,
  };
}

export function makeAuditEvent(
  overrides: Partial<AdminAuditEventResponse> = {},
): AdminAuditEventResponse {
  return {
    id: nextId(),
    actorUserId: nextId(),
    actorName: "Renata",
    actorEmail: "renata@openrift.test",
    action: "card.accept-field",
    entityType: "card",
    entityId: nextId(),
    entityLabel: "Lux, Lady of Luminosity",
    cardSlug: "OGN-001",
    oldValues: { energy: 2 },
    newValues: { energy: 3 },
    createdAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

export function makeUnifiedMappingPrinting(
  overrides: Partial<UnifiedMappingPrintingResponse> = {},
): UnifiedMappingPrintingResponse {
  return {
    printingId: nextId(),
    setId: "ogn",
    shortCode: "OGN-001",
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    markerSlugs: [],
    finish: "normal",
    size: "standard",
    language: "EN",
    imageUrl: null,
    tcgExternalId: null,
    cmExternalId: null,
    ctExternalId: null,
    ...overrides,
  };
}

export function makeStagedProduct(
  overrides: Partial<StagedProductResponse> = {},
): StagedProductResponse {
  return {
    externalId: 1,
    productName: "Lux, Lady of Luminosity",
    finish: "normal",
    language: "EN",
    marketCents: 450,
    lowCents: null,
    midCents: null,
    highCents: null,
    trendCents: null,
    avg1Cents: null,
    avg7Cents: null,
    avg30Cents: null,
    currency: "USD",
    recordedAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

type MarketplaceSlice = UnifiedMappingGroupResponse["tcgplayer"];

function emptyMarketplaceSlice(): MarketplaceSlice {
  return { stagedProducts: [], assignedProducts: [], assignments: [] };
}

export function makeUnifiedMappingGroup(
  overrides: Partial<UnifiedMappingGroupResponse> = {},
): UnifiedMappingGroupResponse {
  return {
    cardId: nextId(),
    cardSlug: "lux-lady-of-luminosity",
    cardName: "Lux, Lady of Luminosity",
    superTypes: ["Champion"],
    domains: ["Order"],
    energy: 4,
    might: 4,
    setId: nextId(),
    setName: "Origins",
    primaryShortCode: "OGN-001",
    printings: [],
    tcgplayer: emptyMarketplaceSlice(),
    cardmarket: emptyMarketplaceSlice(),
    cardtrader: emptyMarketplaceSlice(),
    ...overrides,
  };
}

export function makeCardBan(overrides: Partial<CardBanResponse> = {}): CardBanResponse {
  return {
    id: nextId(),
    cardId: nextId(),
    formatId: "constructed",
    formatName: "Constructed",
    bannedAt: "2026-08-01",
    reason: "Locks the board out of every deck",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeCardErrata(overrides: Partial<CardErrata> = {}): CardErrata {
  return {
    correctedRulesText: "Deal 2 damage to a unit you do not control.",
    correctedEffectText: null,
    source: "Rules update, August 2026",
    sourceUrl: "https://rules.example.test/2026-08",
    effectiveDate: "2026-08-15",
    ...overrides,
  };
}

export function makeAdminPrintingMarketplaceMapping(
  overrides: Partial<AdminPrintingMarketplaceMappingResponse> = {},
): AdminPrintingMarketplaceMappingResponse {
  const printingId = overrides.targetPrintingId ?? nextId();
  return {
    targetPrintingId: printingId,
    marketplace: "tcgplayer",
    externalId: 1,
    productName: "Lux, Lady of Luminosity",
    finish: "normal",
    variantLanguage: null,
    ownerPrintingId: printingId,
    ownerLanguage: "EN",
    ...overrides,
  };
}

export function makeCatalogCardRow(overrides: Partial<CatalogCardRow> = {}): CatalogCardRow {
  return {
    cardSlug: "lux-lady-of-luminosity",
    name: "Lux, Lady of Luminosity",
    normName: "lux-lady-of-luminosity",
    firstSetSlug: "ogn",
    firstSetName: "Origins",
    setSlugs: ["ogn"],
    shortCodes: ["OGN-001"],
    printingCount: 3,
    printingsWithoutImage: 0,
    proposals: 0,
    newPrintings: 0,
    uncheckedTrustedProviders: [],
    needsAttention: false,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeCatalogSource(overrides: Partial<CatalogSource> = {}): CatalogSource {
  return {
    provider: "gallery",
    kind: "upload",
    rows: 212,
    printingRows: 480,
    inReview: 0,
    isHidden: false,
    isFavorite: false,
    helperReviewable: false,
    sortOrder: 0,
    lastUploadedAt: "2026-09-01T00:00:00.000Z",
    ignoredCount: 0,
    ...overrides,
  };
}
