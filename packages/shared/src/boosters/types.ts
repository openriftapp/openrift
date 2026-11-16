import type { Printing } from "../types/catalog.js";

export const BOOSTER_BASES = ["official", "estimate", "guess"] as const;

export type BoosterBasis = (typeof BOOSTER_BASES)[number];

export type BoosterBound = "max";

export interface BoosterPrinting {
  printingId: string;
  printing: Printing;
  setSlug: string;
  language: string;
  shortCode: string;
  rarity: string;
  finish: string;
  artVariant: string;
  size: string;
  isSigned: boolean;
  isOvernumbered: boolean;
  types: readonly string[];
  superTypes: readonly string[];
  hasMarker: boolean;
  hasChannel: boolean;
  isPackExclusive: boolean;
}

export type BoosterPredicate = (printing: BoosterPrinting) => boolean;

interface OutcomeBase {
  slug: string;
  matches: BoosterPredicate;
  basis: BoosterBasis;
}

interface RatedOutcome extends OutcomeBase {
  fillsRest?: false;
  /** Expected cards per pack across the whole slot. */
  perPack: number;
  bound?: BoosterBound;
  cards?: number;
}

interface FillOutcome extends OutcomeBase {
  fillsRest: true;
}

export type BoosterOutcome = RatedOutcome | FillOutcome;

export interface BoosterSlot {
  slug: string;
  count: number;
  outcomes: readonly BoosterOutcome[];
}

export interface BoosterLanguage {
  packsPerBox: number;
  boxesPerCase: number;
  basisCap?: BoosterBasis;
}

interface BoosterAcknowledgement {
  shortCode: string;
  language: string;
}

export interface BoosterDefinition {
  set: string;
  layoutBasis: BoosterBasis;
  languages: Readonly<Record<string, BoosterLanguage>>;
  slots: readonly BoosterSlot[];
  acknowledged: readonly BoosterAcknowledgement[];
}

export interface ResolvedOutcome {
  slug: string;
  slot: string;
  pool: BoosterPrinting[];
  perPack: number;
  bound: BoosterBound | null;
  basis: BoosterBasis;
  fillsRest: boolean;
  cards: number;
}

export interface ResolvedSlot {
  slug: string;
  count: number;
  outcomes: ResolvedOutcome[];
}

export interface ResolvedBooster {
  slug: string;
  set: string;
  language: string;
  packsPerBox: number;
  boxesPerCase: number;
  slots: ResolvedSlot[];
  openable: boolean;
}

export interface BoosterRow {
  printingId: string;
  booster: string;
  slot: string;
  outcome: string;
  outcomePerPack: number;
  bound: BoosterBound | null;
  poolSize: number;
  basis: BoosterBasis;
  packsPerBox: number;
  boxesPerCase: number;
}
