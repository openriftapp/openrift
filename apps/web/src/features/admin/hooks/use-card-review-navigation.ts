import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
  CandidateCardResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  useCheckAllCandidateCards,
  useCheckAllCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useAdminCardListWhen,
  useAllCards,
  useNextUncheckedCard,
} from "@/features/admin/hooks/use-admin-card-queries";
import { useReviewQueueWhen } from "@/features/admin/hooks/use-catalog-review";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { useUnifiedMappingsWhen } from "@/features/admin/hooks/use-unified-mappings";
import { selectAdminCardPrevNext } from "@/features/admin/lib/admin-card-nav";
import type { PrevNextSlugs } from "@/features/admin/lib/admin-card-nav";
import { buildPrintingGroups } from "@/features/admin/lib/candidate-printing-groups";
import { favoriteProviderSet } from "@/features/admin/lib/candidate-rows";
import type { AdminCardListStatus, CardIssue } from "@/features/admin/lib/card-attention";
import { attentionSectionFor, hasIssue, needsAttention } from "@/features/admin/lib/card-attention";
import type { CardSection } from "@/features/admin/lib/card-sections";
import { reviewSectionsBySlug } from "@/features/admin/lib/review-queue";
import {
  ALL_ASSIGNABLE_SCOPE,
  buildPriceAssignBucketsBySlug,
  unlinkedProductCount,
} from "@/features/cards/lib/marketplace-coverage";

/** Everything one "Check all & next" run has to mark as checked. */
export interface ReviewCheckTargets {
  cardSources: boolean;
  printingIds: string[];
  extraCandidateIds: string[][];
}

/**
 * Collect the check-all targets for a review run. Groups stay separate from
 * printings because they are checked by id list, not by printing id.
 */
export function collectReviewCheckTargets(
  sources: readonly CandidateCardResponse[],
  printings: readonly AdminPrintingResponse[],
  candidatePrintings: readonly CandidatePrintingResponse[],
  ambiguousGroups: readonly { candidates: readonly CandidatePrintingResponse[] }[],
): ReviewCheckTargets {
  const printingIds: string[] = [];
  for (const printing of printings) {
    const relatedSources = candidatePrintings.filter((ps) => ps.printingId === printing.id);
    if (relatedSources.some((ps) => !ps.checkedAt)) {
      printingIds.push(printing.id);
    }
  }

  const extraCandidateIds: string[][] = [];
  for (const group of ambiguousGroups) {
    const uncheckedIds = group.candidates.filter((s) => !s.checkedAt).map((s) => s.id);
    if (uncheckedIds.length > 0) {
      extraCandidateIds.push(uncheckedIds);
    }
  }

  return {
    cardSources: sources.some((s) => !s.checkedAt),
    printingIds,
    extraCandidateIds,
  };
}

/**
 * Search params carried through every navigation off the card detail page, so
 * a review run keeps its filters and the list page matches on the way back.
 */
export interface CardReviewNavSearch {
  set?: string;
  status?: AdminCardListStatus;
  priceScope?: string;
}

const STATUS_ISSUES: Partial<Record<AdminCardListStatus, CardIssue>> = {
  proposals: "proposals",
  "new-printings": "new-printings",
  "unchecked-source": "unchecked-source",
  "prices-to-assign": "unlinked-products",
};

interface CardListSearch {
  set?: string;
  tab?: "attention";
  issue?: CardIssue;
  priceScope?: string;
}

export function cardListSearch({ status, set, priceScope }: CardReviewNavSearch): CardListSearch {
  if (status === undefined || status === "review") {
    return set ? { set } : {};
  }
  const issue = STATUS_ISSUES[status];
  return {
    ...(set ? { set } : {}),
    tab: "attention",
    ...(issue ? { issue } : {}),
    ...(priceScope ? { priceScope } : {}),
  };
}

interface UseCardReviewNavigationOptions {
  identifier: string;
  detail?: AdminCardDetailResponse;
  setSlug?: string;
  listStatus?: AdminCardListStatus;
  priceScope?: string;
  section?: CardSection;
  isAdmin: boolean;
  invalidates: readonly (readonly unknown[])[];
}

/**
 * The Card Fields section button and a full run must share the same
 * `checkAllCardSources` instance to share one pending state.
 */
export function useCardReviewNavigation({
  identifier,
  detail,
  setSlug,
  listStatus,
  priceScope,
  section,
  isAdmin,
  invalidates,
}: UseCardReviewNavigationOptions) {
  const navigate = useNavigate();
  const { data: allCards } = useAllCards();
  // The caller's scope, not the mutation's default: that one keys off the card's
  // UUID, while this page's detail query is keyed by slug.
  const checkAllCardSources = useCheckAllCandidateCards(invalidates);
  const checkAllCandidatePrintings = useCheckAllCandidatePrintings(invalidates);

  // Scoped to match the list page's set filter, so navigation stays inside the set.
  const scopedCards = setSlug ? allCards.filter((c) => c.setSlugs.includes(setSlug)) : allCards;
  const scopedSlugs = setSlug ? new Set(scopedCards.map((c) => c.slug)) : null;
  const { fetchNext } = useNextUncheckedCard(identifier, scopedSlugs);

  // Stays subscribed (not read once): the marketplace section invalidates this
  // query after every assignment, dropping a card once its last product is bound.
  const priceFilterActive = listStatus === "prices-to-assign";
  const attentionFilterActive =
    listStatus !== undefined && listStatus !== "review" && !priceFilterActive;
  const { data: unifiedMappings } = useUnifiedMappingsWhen(
    isAdmin && (priceFilterActive || listStatus === "attention"),
  );
  const activePriceScope = priceFilterActive ? (priceScope ?? ALL_ASSIGNABLE_SCOPE) : null;
  const assignBucketsBySlug = unifiedMappings
    ? buildPriceAssignBucketsBySlug(unifiedMappings.groups)
    : null;

  // Same idea over the list corpus: stays subscribed, so resolving a card's
  // last issue drops it once the list is invalidated.
  const issue = listStatus ? STATUS_ISSUES[listStatus] : undefined;
  const { data: cardList } = useAdminCardListWhen(attentionFilterActive);
  const attentionSections = new Map<string, "attention" | "marketplace">();
  for (const row of attentionFilterActive ? (cardList ?? []) : []) {
    if (row.cardSlug === null) {
      continue;
    }
    const unlinked = unlinkedProductCount(
      assignBucketsBySlug?.get(row.cardSlug),
      ALL_ASSIGNABLE_SCOPE,
    );
    const matches = issue ? hasIssue(row, issue, unlinked) : needsAttention(row, unlinked);
    const targetSection = attentionSectionFor(row, unlinked, issue);
    if (matches && targetSection) {
      attentionSections.set(row.cardSlug, targetSection);
    }
  }
  const attentionSlugs =
    attentionFilterActive && cardList ? new Set(attentionSections.keys()) : null;

  const reviewFilterActive = listStatus === "review";
  const { data: reviewQueue } = useReviewQueueWhen(reviewFilterActive);
  const { data: providerSettings } = useProviderSettings();
  const reviewSections =
    reviewFilterActive && reviewQueue
      ? reviewSectionsBySlug(
          reviewQueue.items,
          favoriteProviderSet(providerSettings.providerSettings),
        )
      : null;
  const reviewSlugs = reviewSections ? new Set(reviewSections.keys()) : null;

  // Nearest matching card is found by scanning outward from the full ordering,
  // so the buttons keep working after this card itself falls out of the filter.
  const prevNextCards: PrevNextSlugs = selectAdminCardPrevNext(
    scopedCards.map((c) => c.slug),
    identifier,
    {
      priceScope: activePriceScope,
      assignBucketsBySlug,
      matchingSlugs: attentionSlugs ?? reviewSlugs,
    },
  );

  const navSearch: CardReviewNavSearch = {
    ...(setSlug ? { set: setSlug } : {}),
    ...(listStatus ? { status: listStatus } : {}),
    ...(priceFilterActive && priceScope ? { priceScope } : {}),
  };

  function goToCard(cardSlug: string) {
    const targetSection =
      reviewSections?.get(cardSlug) ??
      (priceFilterActive ? "marketplace" : attentionSections.get(cardSlug)) ??
      section;
    void navigate({
      to: "/admin/cards/$cardSlug",
      params: { cardSlug },
      search: { ...navSearch, ...(targetSection ? { section: targetSection } : {}) },
    });
  }

  function goToList() {
    if (reviewFilterActive) {
      void navigate({ to: "/admin/review" });
      return;
    }
    void navigate({ to: "/admin/cards", search: cardListSearch(navSearch) });
  }

  const [isCheckingAll, setIsCheckingAll] = useState(false);

  async function runCheckAllAndNext() {
    if (isCheckingAll || !detail) {
      return;
    }
    const card = detail.card;
    if (!card) {
      return;
    }
    const targets = collectReviewCheckTargets(
      detail.sources,
      detail.printings,
      detail.candidatePrintings,
      buildPrintingGroups(detail.candidatePrintingGroups, detail.candidatePrintings),
    );

    // Kick off the mutations outside the try so react-compiler doesn't flag the
    // for-of value blocks inside a try/catch statement.
    const promises: Promise<unknown>[] = [];
    if (targets.cardSources) {
      promises.push(checkAllCardSources.mutateAsync(card.id));
    }
    for (const printingId of targets.printingIds) {
      promises.push(checkAllCandidatePrintings.mutateAsync({ printingId }));
    }
    for (const extraIds of targets.extraCandidateIds) {
      promises.push(checkAllCandidatePrintings.mutateAsync({ extraIds }));
    }

    setIsCheckingAll(true);
    try {
      await Promise.all(promises);

      const nextSlug = await fetchNext();
      if (nextSlug) {
        goToCard(nextSlug);
      } else {
        toast.success("All cards reviewed!");
        goToList();
      }
    } catch (error) {
      setIsCheckingAll(false);
      throw error;
    }
    setIsCheckingAll(false);
  }

  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const checkAllAndNextRef = useRef<() => void>(() => {});
  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const prevNextRef = useRef<(dir: "prev" | "next") => void>(() => {});
  useHotkey("Mod+Shift+Enter", () => checkAllAndNextRef.current(), {
    enabled: !isCheckingAll && isAdmin,
  });
  useHotkey("Mod+ArrowLeft", () => prevNextRef.current("prev"));
  useHotkey("Mod+ArrowRight", () => prevNextRef.current("next"));

  // Re-point the ref-backed hotkey handlers every render, in effects (react-compiler
  // forbids ref mutation during render).
  useEffect(() => {
    checkAllAndNextRef.current = () => void runCheckAllAndNext();
  });
  // Same selection as the < / > buttons — both read `prevNextCards`, so the
  // hotkeys can never drift from what the buttons do.
  useEffect(() => {
    prevNextRef.current = (dir) => {
      const slug = dir === "prev" ? prevNextCards.prev : prevNextCards.next;
      if (!slug) {
        return;
      }
      goToCard(slug);
    };
  });

  return {
    prevNextCards,
    navSearch,
    isCheckingAll,
    /** Rejects if a check mutation fails, after clearing the run state. */
    checkAllAndNext: runCheckAllAndNext,
    goToCard,
    goToList,
    checkAllCardSources,
  };
}
