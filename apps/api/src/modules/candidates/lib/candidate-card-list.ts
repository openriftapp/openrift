import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";

import type { candidateCardsRepo } from "../repositories/candidate-cards.js";

type Repo = ReturnType<typeof candidateCardsRepo>;

export async function buildCandidateCardList(
  repo: Repo,
  favoriteProviders: Set<string>,
  allowedProviders: Set<string> | null = null,
): Promise<CandidateCardSummaryResponse[]> {
  const [cards, allCandidateCards, printings, candidatePrintings, aliases, pendingRows] =
    await Promise.all([
      repo.listCardsForSourceList(),
      repo.listCandidateCardsForSourceList(),
      repo.listPrintingsForSourceList(),
      repo.listCandidatePrintingsForSourceList(),
      repo.listAliasesForSourceList(),
      repo.listPendingSubmissionCandidateIds(),
    ]);

  const pendingByCandidateCardId = new Map<string, number>();
  for (const row of pendingRows) {
    pendingByCandidateCardId.set(
      row.candidateCardId,
      (pendingByCandidateCardId.get(row.candidateCardId) ?? 0) + 1,
    );
  }

  // card-review grant holders only see candidates from allowed providers
  // (null = full admin, unscoped). Filtering here keeps every derived
  // structure (groups, staging codes, counts) consistent for free.
  const candidateCards =
    allowedProviders === null
      ? allCandidateCards
      : allCandidateCards.filter((cc) => allowedProviders.has(cc.provider));

  const shortCodesByCardId = new Map<string, string[]>();
  const setSlugsByCardId = new Map<string, Set<string>>();
  for (const p of printings) {
    let arr = shortCodesByCardId.get(p.cardId);
    if (!arr) {
      arr = [];
      shortCodesByCardId.set(p.cardId, arr);
    }
    const label =
      p.language === WellKnown.language.EN ? p.shortCode : `${p.shortCode} [${p.language}]`;
    arr.push(label);
    if (p.setSlug) {
      let slugs = setSlugsByCardId.get(p.cardId);
      if (!slugs) {
        slugs = new Set();
        setSlugsByCardId.set(p.cardId, slugs);
      }
      slugs.add(p.setSlug);
    }
  }

  // A name made only of punctuation or symbols normalizes to `""`, which as a
  // grouping key would merge every such candidate into one row. Those rows are
  // unmatchable — there is no key to look a card up by — so they are grouped
  // by raw name instead and surfaced individually. The `\u0000` prefix
  // cannot collide with a real normName, which only ever holds letters and digits.
  const ccGroupsByNormName = new Map<string, typeof candidateCards>();
  for (const cc of candidateCards) {
    const groupKey = cc.normName === "" ? `\u0000name:${cc.name}` : cc.normName;
    let arr = ccGroupsByNormName.get(groupKey);
    if (!arr) {
      arr = [];
      ccGroupsByNormName.set(groupKey, arr);
    }
    arr.push(cc);
  }

  // orderIndex preserves the repo's canonical printing order for the later global re-sort.
  const cpByCandidateCardId = new Map<
    string,
    ((typeof candidatePrintings)[number] & { orderIndex: number })[]
  >();
  for (const [orderIndex, cp] of candidatePrintings.entries()) {
    let arr = cpByCandidateCardId.get(cp.candidateCardId);
    if (!arr) {
      arr = [];
      cpByCandidateCardId.set(cp.candidateCardId, arr);
    }
    arr.push({ ...cp, orderIndex });
  }

  // Duplicates are kept so the frontend can show counts (e.g. "OGN-001a* ×2").
  // Linked candidate printings are skipped — they're already resolved to an
  // accepted printing.
  function stagingIdsForGroup(group: typeof candidateCards, onlyFavorites?: boolean): string[] {
    const entries: { label: string; orderIndex: number }[] = [];
    for (const cc of group) {
      if (onlyFavorites && !favoriteProviders.has(cc.provider)) {
        continue;
      }
      for (const cp of cpByCandidateCardId.get(cc.id) ?? []) {
        if (!cp.checkedAt && !cp.printingId) {
          const label =
            !cp.language || cp.language === WellKnown.language.EN
              ? cp.shortCode
              : `${cp.shortCode} [${cp.language}]`;
          entries.push({ label, orderIndex: cp.orderIndex });
        }
      }
    }
    return entries.toSorted((a, b) => a.orderIndex - b.orderIndex).map((e) => e.label);
  }

  // Distinct set slugs across a group's candidate printings. For candidate
  // printings `setId` holds the slug directly (unlike accepted printings, which
  // store a UUID), so no resolution is needed. Includes every candidate printing
  // so a not-yet-accepted new-set reprint still surfaces under that set's filter.
  function candidateSetSlugsForGroup(group: typeof candidateCards): string[] {
    const slugs = new Set<string>();
    for (const cc of group) {
      for (const cp of cpByCandidateCardId.get(cc.id) ?? []) {
        if (cp.setId) {
          slugs.add(cp.setId);
        }
      }
    }
    return [...slugs];
  }

  // Includes linked printings (printingId set) — they still need review.
  function uncheckedPrintingCountForGroup(
    group: typeof candidateCards,
    onlyFavorites?: boolean,
  ): number {
    let count = 0;
    for (const cc of group) {
      if (onlyFavorites && !favoriteProviders.has(cc.provider)) {
        continue;
      }
      for (const cp of cpByCandidateCardId.get(cc.id) ?? []) {
        if (!cp.checkedAt) {
          count++;
        }
      }
    }
    return count;
  }

  // No provider or checkedAt narrowing: these are the rows the detail page
  // renders as "New:" groups, and it groups every unlinked candidate printing
  // the same way.
  function unlinkedPrintingCountForGroup(
    group: typeof candidateCards,
    onlyTrusted?: boolean,
  ): number {
    let count = 0;
    for (const cc of group) {
      if (onlyTrusted && !favoriteProviders.has(cc.provider)) {
        continue;
      }
      for (const cp of cpByCandidateCardId.get(cc.id) ?? []) {
        if (!cp.printingId) {
          count++;
        }
      }
    }
    return count;
  }

  function pendingSubmissions(group: typeof candidateCards | null): number {
    let count = 0;
    for (const cc of group ?? []) {
      count += pendingByCandidateCardId.get(cc.id) ?? 0;
    }
    return count;
  }

  function uncheckedTrustedProviders(group: typeof candidateCards | null): string[] {
    const providers = new Set<string>();
    for (const cc of group ?? []) {
      if (!favoriteProviders.has(cc.provider)) {
        continue;
      }
      const candidatePrintingRows = cpByCandidateCardId.get(cc.id) ?? [];
      if (!cc.checkedAt || candidatePrintingRows.some((cp) => !cp.checkedAt)) {
        providers.add(cc.provider);
      }
    }
    return [...providers].toSorted();
  }

  function latestWrite(cardUpdatedAt: Date | null, group: typeof candidateCards | null): Date {
    let latest = cardUpdatedAt;
    for (const cc of group ?? []) {
      if (latest === null || cc.updatedAt > latest) {
        latest = cc.updatedAt;
      }
    }
    return latest ?? new Date(0);
  }

  const aliasNormNamesByCardId = new Map<string, string[]>();
  for (const a of aliases) {
    let arr = aliasNormNamesByCardId.get(a.cardId);
    if (!arr) {
      arr = [];
      aliasNormNamesByCardId.set(a.cardId, arr);
    }
    arr.push(a.normName);
  }

  // Match candidate card groups to cards by normName (+ aliases) and delete matched entries —
  // whatever's left in ccGroupsByNormName afterwards has no card yet (candidates)
  const results: CandidateCardSummaryResponse[] = cards.map((card) => {
    const allGroups: typeof candidateCards = [];
    const directGroup = ccGroupsByNormName.get(card.normName);
    if (directGroup) {
      allGroups.push(...directGroup);
      ccGroupsByNormName.delete(card.normName);
    }
    for (const aliasNorm of aliasNormNamesByCardId.get(card.id) ?? []) {
      const aliasGroup = ccGroupsByNormName.get(aliasNorm);
      if (aliasGroup) {
        allGroups.push(...aliasGroup);
        ccGroupsByNormName.delete(aliasNorm);
      }
    }
    const group = allGroups.length > 0 ? allGroups : null;
    return {
      cardSlug: card.slug,
      name: card.name,
      normalizedName: card.normName,
      shortCodes: shortCodesByCardId.get(card.id) ?? [],
      stagingShortCodes: group ? stagingIdsForGroup(group) : [],
      setSlugs: [
        ...new Set([
          ...(setSlugsByCardId.get(card.id) ?? []),
          ...(group ? candidateSetSlugsForGroup(group) : []),
        ]),
      ].toSorted(),
      candidateCount: group?.length ?? 0,
      uncheckedCardCount:
        group?.filter((cc) => !cc.checkedAt && favoriteProviders.has(cc.provider)).length ?? 0,
      uncheckedPrintingCount: group ? uncheckedPrintingCountForGroup(group, true) : 0,
      unlinkedPrintingCount: group ? unlinkedPrintingCountForGroup(group) : 0,
      unlinkedTrustedPrintingCount: group ? unlinkedPrintingCountForGroup(group, true) : 0,
      hasFavorite: group?.some((cc) => favoriteProviders.has(cc.provider)) ?? false,
      favoriteStagingShortCodes: group ? stagingIdsForGroup(group, true) : [],
      suggestedCardSlug: null,
      hasUserSubmission: group?.some((cc) => cc.provider === USER_SUBMISSION_PROVIDER) ?? false,
      pendingSubmissions: pendingSubmissions(group),
      uncheckedTrustedProviders: uncheckedTrustedProviders(group),
      updatedAt: latestWrite(card.updatedAt, group).toISOString(),
    };
  });

  function findSuggestedCard(normName: string): string | null {
    let bestSlug: string | null = null;
    let bestLen = 0;
    for (const card of cards) {
      if (normName.startsWith(card.normName) && card.normName.length > bestLen) {
        bestSlug = card.slug;
        bestLen = card.normName.length;
      }
    }
    return bestSlug;
  }

  for (const group of ccGroupsByNormName.values()) {
    const [firstCandidate] = group;
    if (!firstCandidate) {
      continue;
    }
    // Not the map key — punctuation-only names are keyed by raw name so they
    // stay separate rows, but the response still carries their real (empty)
    // normalizedName, which the client uses to suppress the accept/link
    // affordances that need a lookup key.
    const normName = firstCandidate.normName;
    results.push({
      cardSlug: null,
      name: firstCandidate.name,
      normalizedName: normName,
      shortCodes: [],
      stagingShortCodes: stagingIdsForGroup(group),
      setSlugs: candidateSetSlugsForGroup(group).toSorted(),
      candidateCount: group.length,
      uncheckedCardCount: group.filter((cc) => !cc.checkedAt && favoriteProviders.has(cc.provider))
        .length,
      uncheckedPrintingCount: uncheckedPrintingCountForGroup(group, true),
      unlinkedPrintingCount: unlinkedPrintingCountForGroup(group),
      unlinkedTrustedPrintingCount: unlinkedPrintingCountForGroup(group, true),
      hasFavorite: group.some((cc) => favoriteProviders.has(cc.provider)),
      favoriteStagingShortCodes: stagingIdsForGroup(group, true),
      suggestedCardSlug: findSuggestedCard(normName),
      hasUserSubmission: group.some((cc) => cc.provider === USER_SUBMISSION_PROVIDER),
      pendingSubmissions: pendingSubmissions(group),
      uncheckedTrustedProviders: uncheckedTrustedProviders(group),
      updatedAt: latestWrite(null, group).toISOString(),
    });
  }

  // When provider-scoped, a matched card with no visible candidates is noise
  // for the reviewer — drop it so the list only shows reviewable groups.
  // (Unmatched rows derive from the filtered candidates, so they always keep
  // at least one.)
  return allowedProviders === null ? results : results.filter((row) => row.candidateCount > 0);
}
