import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  uncheckCandidateCardsFn,
  uncheckCandidatePrintingsFn,
  useAcceptPrintingGroups,
  useCheckAllCandidatePrintings,
  useCheckPass,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { readyPreviewQueryOptions } from "@/features/catalog-workspace/hooks/use-workspace-batch";
import {
  useCardView,
  useWorkspaceSearch,
} from "@/features/catalog-workspace/hooks/use-workspace-records";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { PassDismiss } from "@/features/catalog-workspace/lib/card-pass";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import { toAcceptInput } from "@/features/catalog-workspace/lib/creation-draft";
import { listingsQueryOptions } from "@/features/catalog-workspace/lib/listings-queries";
import { buildReadyRows } from "@/features/catalog-workspace/lib/ready-rows";
import { cardRecordScope } from "@/features/catalog-workspace/lib/record-scopes";
import {
  NEW_CARD_KEY_PREFIX,
  reviewCardsByKey,
  reviewCardsQueryOptions,
  reviewNeighbor,
  reviewSteps,
} from "@/features/catalog-workspace/lib/review-cards";
import type { ReviewStop, ReviewTrail } from "@/features/catalog-workspace/lib/review-stops";
import { stopNavigation } from "@/features/catalog-workspace/lib/review-stops";
import { discardUndoText, undoScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { focusRecordPane } from "@/features/catalog-workspace/stores/workspace-record-pane-store";
import { withWriteSignal } from "@/lib/write-signal";

const EMPTY_CARDS: readonly ReviewCard[] = [];

export function useReviewNavigation(key: string, trail?: ReviewTrail) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const resolvedPathname = useRouterState({ select: (state) => state.resolvedLocation?.pathname });
  const { data: access } = useAdminAccess();
  const routeView = useCardView();
  const routeQuery = useWorkspaceSearch().q;
  const asked = trail === undefined ? routeView : trail.queue;
  const adminView = asked === "ready" || asked === "listings";
  const view = adminView && access?.isAdmin !== true ? undefined : asked;
  const q = trail === undefined ? routeQuery : trail.q;
  const { data } = useQuery(reviewCardsQueryOptions());
  const { data: listings } = useQuery({ ...listingsQueryOptions(), enabled: view === "listings" });
  const { data: preview } = useQuery({ ...readyPreviewQueryOptions(), enabled: view === "ready" });
  const reviewCards = data?.cards ?? EMPTY_CARDS;
  const steps = reviewSteps(view, {
    reviewCards,
    listingCards: listings?.cards,
    readyRows: preview && buildReadyRows(reviewCards, preview.cards, preview.printings),
  });
  const index = steps.findIndex((entry) => entry.key === key);
  const [lastIndex, setLastIndex] = useState(index === -1 ? (trail?.cardIndex ?? -1) : index);
  if (index !== -1 && index !== lastIndex) {
    setLastIndex(index);
  }

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function leaveFor(toList: boolean): boolean {
    // A write that lands after the admin moved on must not step away from the newer page.
    if (router.latestLocation.pathname !== resolvedPathname) {
      return false;
    }
    if (mounted.current) {
      useWorkspaceActionsStore.getState().leave(toList);
    }
    focusRecordPane();
    return true;
  }

  function step(delta: 1 | -1, skipKey?: string) {
    const target = reviewNeighbor(steps, key, delta, lastIndex, skipKey);
    if ((target === null && delta === -1) || !leaveFor(target === null)) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: adminKeys.workspaceReview });
    const search = trail === undefined ? true : { queue: trail.queue, q: trail.q };
    if (target === null) {
      void navigate({ to: "/admin/workspace/cards", search });
    } else if (target.cardSlug === null) {
      void navigate({
        to: "/admin/workspace/cards/new/$name",
        params: { name: target.key.slice(NEW_CARD_KEY_PREFIX.length) },
        search,
      });
    } else {
      void navigate({
        to: "/admin/workspace/cards/$cardSlug",
        params: { cardSlug: target.cardSlug },
        search,
        hash: view === "listings" ? "listings" : undefined,
      });
    }
  }

  return {
    goNext: (skipKey?: string) => step(1, skipKey),
    goPrev: () => step(-1),
    advance: (stop: ReviewStop | null, stopTrail: ReviewTrail) => {
      if (stop === null) {
        step(1);
      } else if (leaveFor(false)) {
        void navigate(stopNavigation(stop, stopTrail));
      }
    },
    position: index === -1 ? null : { index, total: steps.length },
    inReview: index !== -1 || lastIndex !== -1,
    reviewCard: reviewCardsByKey(reviewCards).get(key) ?? null,
    trailFor: (cardSlug: string): ReviewTrail => ({
      cardSlug,
      queue: view,
      q,
      cardIndex: lastIndex,
    }),
  };
}

export function usePassDismiss({
  scope,
  cardId,
  record,
  dismiss,
}: {
  scope: readonly (readonly unknown[])[];
  cardId?: string;
  record: string;
  dismiss: PassDismiss;
}) {
  const checkPass = useCheckPass(scope);
  const checkPrintings = useCheckAllCandidatePrintings(scope);
  const { announce } = useWorkspaceUndo();

  async function run(signal: AbortSignal, target: PassDismiss = dismiss) {
    const cardIds = [...target.candidateCardIds];
    const printingIds = [...target.candidatePrintingIds];
    if (cardIds.length === 0 && printingIds.length === 0) {
      return;
    }
    await (cardId === undefined
      ? checkPrintings.mutateAsync({ extraIds: printingIds }, { signal })
      : checkPass.mutateAsync(
          { cardId, candidateCardIds: cardIds, candidatePrintingIds: printingIds },
          { signal },
        ));
    const text = discardUndoText({
      suggestions: target.suggestions,
      images: 0,
      sources: cardIds.length + printingIds.length,
      record,
    });
    announce({
      ...text,
      invalidates: undoScope(scope),
      undo: async (undoSignal) => {
        if (cardIds.length > 0) {
          await withWriteSignal(undoSignal, () =>
            uncheckCandidateCardsFn({ data: { candidateCardIds: cardIds }, signal: undoSignal }),
          );
        }
        if (printingIds.length > 0) {
          await withWriteSignal(undoSignal, () =>
            uncheckCandidatePrintingsFn({
              data: { candidatePrintingIds: printingIds },
              signal: undoSignal,
            }),
          );
        }
      },
    });
  }

  return { run, pending: checkPass.isPending || checkPrintings.isPending };
}

export function usePassCreatePrinting(cardSlug: string) {
  const acceptGroups = useAcceptPrintingGroups(cardRecordScope(cardSlug));

  async function create(signal: AbortSignal, drafts: readonly CreationDraft[]) {
    const inputs = drafts.map((draft) => toAcceptInput(draft));
    const [first] = inputs;
    if (first === undefined) {
      return;
    }
    await acceptGroups.mutateAsync(
      { cardId: first.cardId, groups: inputs.map(({ cardId: _cardId, ...group }) => group) },
      { signal },
    );
  }

  return { create, pending: acceptGroups.isPending };
}
