import type { CardSearchIndex, SearchableCard } from "@openrift/shared/card-search";
import {
  buildCardIndex,
  CARD_SEARCH_MIN_QUERY_LENGTH,
  searchCards,
} from "@openrift/shared/card-search";
import { extractCardIdFromShortCode } from "@openrift/shared/printing-code";
import { WellKnown } from "@openrift/shared/well-known";
import type { Selectable } from "kysely";

import type { CandidatePrintingsTable } from "../../../db/tables/candidates.js";
import type {
  PrintingProbeRow,
  TrustedDraftRow,
  TrustedNewPrintingRow,
} from "../repositories/workspace-batch.js";
import {
  acceptFieldsFromCandidate,
  candidateAcceptKey,
  candidatePrintingLabel,
} from "./candidate-printing-accept.js";

type CandidatePrintingRow = Selectable<CandidatePrintingsTable>;

export interface TrustedCardDraft {
  normName: string;
  name: string;
}

export interface TrustedPrintingGroup {
  cardId: string;
  cardSlug: string;
  label: string;
  first: CandidatePrintingRow;
  candidates: CandidatePrintingRow[];
}

export function nameHead(name: string): string {
  return name.split(",")[0]?.trim() ?? name;
}

/** Must match the new-card record's "Already in the catalog?" suggestion. */
function hasMergeCandidate(index: CardSearchIndex<SearchableCard>, name: string): boolean {
  const head = nameHead(name);
  return head.length >= CARD_SEARCH_MIN_QUERY_LENGTH && searchCards(index, head, 1).length > 0;
}

export function eligibleTrustedCards(
  drafts: readonly TrustedDraftRow[],
  printings: readonly CandidatePrintingRow[],
  liveCards: readonly SearchableCard[],
): TrustedCardDraft[] {
  const index = buildCardIndex(liveCards, new Map());
  const completePrintingCardIds = new Set(
    printings
      .filter((cp) => acceptFieldsFromCandidate(cp).fields !== undefined)
      .map((cp) => cp.candidateCardId),
  );
  const out: TrustedCardDraft[] = [];
  for (const group of Map.groupBy(drafts, (draft) => draft.normName).values()) {
    const primary = group.toSorted((a, b) => a.provider.localeCompare(b.provider))[0];
    if (
      !primary ||
      primary.types.length === 0 ||
      !group.some((draft) => completePrintingCardIds.has(draft.id)) ||
      hasMergeCandidate(index, primary.name)
    ) {
      continue;
    }
    out.push({ normName: primary.normName, name: primary.name });
  }
  return out.toSorted((a, b) => a.name.localeCompare(b.name));
}

export function trustedPrintingGroups(
  rows: readonly TrustedNewPrintingRow[],
  printings: readonly CandidatePrintingRow[],
): TrustedPrintingGroup[] {
  const printingById = new Map(printings.map((cp) => [cp.id, cp]));
  const groups = new Map<string, TrustedPrintingGroup>();
  for (const row of rows) {
    const cp = printingById.get(row.id);
    if (!cp) {
      continue;
    }
    const key = `${row.cardId}|${candidateAcceptKey(cp)}`;
    const group = groups.get(key);
    if (group) {
      group.candidates.push(cp);
      continue;
    }
    groups.set(key, {
      cardId: row.cardId,
      cardSlug: row.cardSlug,
      label: candidatePrintingLabel(cp),
      first: cp,
      candidates: [cp],
    });
  }
  return [...groups.values()];
}

function codeStem(shortCode: string): string {
  return extractCardIdFromShortCode(shortCode.split("/")[0]?.trim() ?? "").toUpperCase();
}

function sameSlugSet(a: readonly string[], b: readonly string[]): boolean {
  const sortedB = b.toSorted();
  return a.length === b.length && a.toSorted().every((slug, index) => slug === sortedB[index]);
}

export function findDuplicatePrinting(
  group: TrustedPrintingGroup,
  probes: readonly PrintingProbeRow[],
): PrintingProbeRow | undefined {
  const stem = codeStem(group.first.shortCode);
  const language = group.first.language ?? WellKnown.language.EN;
  if (stem.length === 0) {
    return undefined;
  }
  return probes.find(
    (probe) =>
      probe.cardId === group.cardId &&
      probe.language === language &&
      codeStem(probe.shortCode) === stem &&
      sameSlugSet(probe.distributionChannelSlugs, group.first.distributionChannelSlugs),
  );
}
