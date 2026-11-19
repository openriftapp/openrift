import type { MissingImagePrinting } from "@openrift/shared/contracts/card-submissions";

import { useCards, useCatalogTailState } from "@/features/cards/hooks/use-cards";
import { useMyMissingImages } from "@/features/contribute/hooks/use-missing-images";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { useOnboardingStore } from "@/stores/onboarding-store";

const PREVIEW_LIMIT = 3;

interface MissingImagesNudge {
  items: MissingImagePrinting[];
  preview: MissingImagePrinting[];
  visible: boolean;
  /** False while a previewed printing's variant text waits for the catalogue's other languages. */
  textFinal: boolean;
}

export function useMissingImagesNudge(): MissingImagesNudge {
  const dismissedPrintings = useOnboardingStore((state) => state.dismissedMissingImagePrintings);
  const { data } = useMyMissingImages();
  const { printingsById } = useCards();
  const tail = useCatalogTailState();

  const items = data?.items ?? [];
  const preview = items.slice(0, PREVIEW_LIMIT);
  const visible = items.some((item) => !dismissedPrintings.includes(item.printingId));
  const waitsForTail =
    visible &&
    tail.status === "loading" &&
    preview.some((item) => printingsById[item.printingId] === undefined);

  // Only a visitor whose preview needs the other languages fetches them before idle.
  useScopeEffect(waitsForTail, (waiting) => {
    if (waiting) {
      tail.retry();
    }
  });

  return { items, preview, visible, textFinal: !waitsForTail };
}
