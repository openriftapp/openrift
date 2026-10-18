import type {
  ArtVariant,
  CardSize,
  FallbackArtMode,
  Finish,
  Rarity,
} from "@openrift/shared/types/enums";

import type { PrintingsTable } from "./catalog.js";

export interface MvLatestPrintingPricesView {
  printingId: string;
  marketplace: string;
  headlineCents: number;
  /** A date, not a timestamp. */
  lastSeen: string;
}

/** `day` is a date, not a timestamp. */
export interface MvDailyPrintingPricesView {
  printingId: string;
  marketplace: string;
  day: string;
  headlineCents: number;
}

// Must stay exported — TypeScript names it in inferred Kysely query return
// types (e.g. selectCopyWithCard in repositories/query-helpers.ts).
// oxlint-disable-next-line jsdoc/check-tag-names -- @public is consumed by knip to suppress the unused-export warning
/** @public */
export interface MvCardAggregatesView {
  cardId: string;
  domains: string[];
  superTypes: string[];
  types: string[];
  tokenCardIds: string[];
}

export interface PrintingSidesOrderedView {
  printingId: string;
  position: 1 | 2;
  faceId: string;
  cardId: string;
  setId: string;
  shortCode: string;
  publicCode: string;
  artVariant: ArtVariant;
  artist: string;
  printedName: string | null;
  printedRulesText: string | null;
  printedEffectText: string | null;
  flavorText: string | null;
  language: string;
  rarity: Rarity;
  printedYear: number | null;
  finish: Finish;
  isSigned: boolean;
  isOvernumbered: boolean;
  markerSlugs: string[];
  fallbackArtMode: FallbackArtMode;
  fallbackImageFileId: string | null;
  faceComment: string | null;
  slug: string;
  size: CardSize;
  releasedAt: string | null;
  releasePrecision: PrintingsTable["releasePrecision"];
  announcedAt: string | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  canonicalRank: number;
  hasFoilTwin: boolean;
}

// oxlint-disable-next-line jsdoc/check-tag-names -- @public is consumed by knip to suppress the unused-export warning
/** @public */
export interface MvPrintingFoilTwinsView {
  printingId: string;
}
