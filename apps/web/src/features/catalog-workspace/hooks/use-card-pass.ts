import { toError } from "@openrift/shared/strings";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  uncheckCandidateCardsFn,
  uncheckCandidatePrintingsFn,
  useAcceptPrintingGroup,
  useCheckAllCandidatePrintings,
  useCheckCandidateCards,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { cardRecordScope } from "@/features/catalog-workspace/hooks/use-card-record-actions";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { PassDismiss } from "@/features/catalog-workspace/lib/card-pass";
import { reviewNeighbor } from "@/features/catalog-workspace/lib/card-pass";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import { toAcceptInput } from "@/features/catalog-workspace/lib/creation-draft";
import { reviewNeighborByKey } from "@/features/catalog-workspace/lib/new-card-pass";
import {
  NEW_CARD_KEY_PREFIX,
  reviewCardsQueryOptions,
} from "@/features/catalog-workspace/lib/review-cards";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import {
  combinedUndo,
  discardUndoText,
  undoScope,
} from "@/features/catalog-workspace/lib/workspace-undo";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { focusRecordPane } from "@/features/catalog-workspace/stores/workspace-record-pane-store";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { withWriteSignal } from "@/lib/write-signal";

export function useReviewNavigation(card: string | { reviewKey: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const resolvedPathname = useRouterState({ select: (state) => state.resolvedLocation?.pathname });
  const { data } = useQuery(reviewCardsQueryOptions());
  const cards = data?.cards ?? [];
  const cardSlug = typeof card === "string" ? card : null;
  const reviewKey = typeof card === "string" ? null : card.reviewKey;
  const index = cards.findIndex((entry) =>
    reviewKey === null ? entry.cardSlug === cardSlug : entry.key === reviewKey,
  );
  const [lastIndex, setLastIndex] = useState(index);
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

  function step(delta: 1 | -1, skipKey?: string) {
    // A write that lands after the admin moved on must not step away from the newer card.
    if (router.latestLocation.pathname !== resolvedPathname) {
      return;
    }
    const target =
      reviewKey === null
        ? reviewNeighbor(cards, cardSlug ?? "", delta, lastIndex)
        : reviewNeighborByKey(cards, reviewKey, delta, lastIndex, skipKey);
    if (target === null && delta === -1) {
      return;
    }
    if (mounted.current) {
      useWorkspaceActionsStore.getState().leave(target === null);
    }
    focusRecordPane();
    if (target === null) {
      void navigate({ to: "/admin/workspace/review" });
    } else if (target.cardSlug === null) {
      void navigate({
        to: "/admin/workspace/cards/new/$name",
        params: { name: target.key.slice(NEW_CARD_KEY_PREFIX.length) },
      });
    } else {
      void navigate({
        to: "/admin/workspace/cards/$cardSlug",
        params: { cardSlug: target.cardSlug },
      });
    }
  }

  return {
    goNext: (skipKey?: string) => step(1, skipKey),
    goPrev: () => step(-1),
    position: index === -1 ? null : { index, total: cards.length },
    inReview: index !== -1 || lastIndex !== -1,
    reviewCard: cards[index] ?? null,
  };
}

export function usePassDismiss({
  cardSlug,
  cardId,
  record,
  dismiss,
}: {
  cardSlug: string;
  cardId: string;
  record: string;
  dismiss: PassDismiss;
}) {
  const scope = cardRecordScope(cardSlug);
  const checkCards = useCheckCandidateCards(scope);
  const checkPrintings = useCheckAllCandidatePrintings(scope);
  const { push } = useWorkspaceUndo();

  async function run(signal: AbortSignal) {
    const cardIds = [...dismiss.candidateCardIds];
    const printingIds = [...dismiss.candidatePrintingIds];
    const entries: WorkspaceUndoEntry[] = [];
    const undoOf = (undo: WorkspaceUndoEntry["undo"]): WorkspaceUndoEntry => ({
      label: "",
      undoneLabel: "",
      invalidates: undoScope(scope),
      undo,
    });
    if (cardIds.length > 0) {
      await checkCards.mutateAsync({ cardId, candidateCardIds: cardIds }, { signal });
      entries.push(
        undoOf((undoSignal) =>
          withWriteSignal(undoSignal, () =>
            uncheckCandidateCardsFn({ data: { candidateCardIds: cardIds }, signal: undoSignal }),
          ),
        ),
      );
    }
    let failure: unknown = null;
    if (printingIds.length > 0) {
      const ok = await runReportedMutation(
        () => checkPrintings.mutateAsync({ extraIds: printingIds }, { signal }),
        (error) => {
          failure = error;
        },
      );
      if (ok) {
        entries.push(
          undoOf((undoSignal) =>
            withWriteSignal(undoSignal, () =>
              uncheckCandidatePrintingsFn({
                data: { candidatePrintingIds: printingIds },
                signal: undoSignal,
              }),
            ),
          ),
        );
      }
    }
    if (entries.length > 0) {
      const text = discardUndoText({
        suggestions: failure === null ? dismiss.suggestions : 0,
        images: 0,
        sources: failure === null ? cardIds.length + printingIds.length : cardIds.length,
        record,
      });
      push(combinedUndo(text, entries));
    }
    if (failure !== null) {
      throw toError(failure);
    }
  }

  return { run, pending: checkCards.isPending || checkPrintings.isPending };
}

export function usePassCreatePrinting(cardSlug: string) {
  const acceptGroup = useAcceptPrintingGroup(cardRecordScope(cardSlug));

  async function create(signal: AbortSignal, drafts: readonly CreationDraft[]) {
    for (const draft of drafts) {
      await acceptGroup.mutateAsync(toAcceptInput(draft), { signal });
    }
  }

  return { create, pending: acceptGroup.isPending };
}
