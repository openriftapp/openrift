import type {
  AdminCardDetailResponse,
  AdminMarketplaceName,
} from "@openrift/shared/types/api/admin";
import { useEffect, useRef, useState } from "react";

import {
  candidateGroupKey,
  cardFoldKeys,
  foldsFocusing,
  hasFace,
  marketplaceFocusFace,
  NEEDS_DECISION_ID,
  scrollIntoViewNextFrame,
  scrollToFace,
} from "@/features/admin/lib/card-page-focus";
import type { CardSection } from "@/features/admin/lib/card-sections";
import { faceIdsOfPrinting } from "@/features/admin/lib/face-rows";
import {
  getCollapsedSections,
  useAdminCardFoldStore,
} from "@/features/admin/stores/admin-card-fold-store";

export function useCardPageFocus({
  cardId,
  detail,
  face,
  section,
  focusMarketplace,
  focusFinish,
  focusLanguage,
  goToSection,
}: {
  cardId: string;
  detail?: AdminCardDetailResponse;
  face?: string;
  section?: CardSection;
  focusMarketplace?: AdminMarketplaceName;
  focusFinish?: string;
  focusLanguage?: string;
  goToSection: (section: CardSection) => Promise<unknown>;
}) {
  const focusPrintingFold = useAdminCardFoldStore((state) => state.focusPrinting);
  const setCollapsedForCard = useAdminCardFoldStore((state) => state.setCollapsedForCard);
  const initCollapsedForCard = useAdminCardFoldStore((state) => state.initCollapsedForCard);
  const decisionsFolded = useAdminCardFoldStore((state) =>
    getCollapsedSections(state).has("attention"),
  );
  const toggleSectionFold = useAdminCardFoldStore((state) => state.toggleSection);

  const [acceptedPrinting, setAcceptedPrinting] = useState<{ printingId: string } | null>(null);
  const acceptedHandledRef = useRef<{ printingId: string } | null>(null);
  const faceHandledRef = useRef<string | null>(null);
  const decisionsHandledRef = useRef(false);
  const marketplaceHandledRef = useRef(false);
  const hasDetail = detail !== undefined;

  // Seeding runs before the focus effects below, which reach into a seeded card
  // to open one row.
  useEffect(() => {
    if (!detail) {
      return;
    }
    initCollapsedForCard(cardId, new Set(cardFoldKeys(detail)));
  }, [detail, cardId, initCollapsedForCard]);

  useEffect(() => {
    if (!acceptedPrinting || acceptedHandledRef.current === acceptedPrinting || !detail) {
      return;
    }
    const faceIds = faceIdsOfPrinting(detail.printings, acceptedPrinting.printingId);
    if (faceIds.length === 0) {
      return;
    }
    acceptedHandledRef.current = acceptedPrinting;
    setCollapsedForCard(cardId, foldsFocusing(detail, faceIds));
    scrollToFace(faceIds[0]);
  }, [acceptedPrinting, detail, cardId, setCollapsedForCard]);

  useEffect(() => {
    if (face === undefined) {
      faceHandledRef.current = null;
      return;
    }
    if (faceHandledRef.current === face || !detail || !hasFace(detail, face)) {
      return;
    }
    faceHandledRef.current = face;
    setCollapsedForCard(cardId, foldsFocusing(detail, [face]));
    scrollToFace(face);
  }, [face, detail, cardId, setCollapsedForCard]);

  useEffect(() => {
    if (section !== "attention") {
      decisionsHandledRef.current = false;
      return;
    }
    if (decisionsHandledRef.current || !hasDetail) {
      return;
    }
    decisionsHandledRef.current = true;
    if (decisionsFolded) {
      toggleSectionFold("attention");
    }
    scrollIntoViewNextFrame(`#${NEEDS_DECISION_ID}`, "start");
  }, [section, hasDetail, decisionsFolded, toggleSectionFold]);

  useEffect(() => {
    if (marketplaceHandledRef.current || !focusMarketplace || !focusFinish || !detail) {
      return;
    }
    const faceId = marketplaceFocusFace(
      detail.printings,
      focusMarketplace,
      focusFinish,
      focusLanguage,
    );
    if (faceId === null) {
      return;
    }
    marketplaceHandledRef.current = true;
    setCollapsedForCard(cardId, foldsFocusing(detail, [faceId]));
    scrollToFace(faceId);
  }, [focusMarketplace, focusFinish, focusLanguage, detail, cardId, setCollapsedForCard]);

  function revealPrinting(printingId: string): void {
    if (!detail) {
      return;
    }
    const faceIds = faceIdsOfPrinting(detail.printings, printingId);
    setCollapsedForCard(cardId, foldsFocusing(detail, faceIds));
    void (async () => {
      await goToSection("printings");
      scrollToFace(faceIds[0]);
    })();
  }

  function revealNewPrinting(candidatePrintingId: string): void {
    if (!detail) {
      return;
    }
    const groupKey = candidateGroupKey(detail, candidatePrintingId);
    if (groupKey === null) {
      return;
    }
    focusPrintingFold(cardId, groupKey, cardFoldKeys(detail));
    void (async () => {
      await goToSection("printings");
      scrollIntoViewNextFrame(`[data-printing-group="${groupKey}"]`, "center");
    })();
  }

  function focusAcceptedPrinting(printingId: string): void {
    setAcceptedPrinting({ printingId });
  }

  return { revealPrinting, revealNewPrinting, focusAcceptedPrinting };
}
