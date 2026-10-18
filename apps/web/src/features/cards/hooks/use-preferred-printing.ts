import { preferredPrinting } from "@openrift/shared/printing-select";
import type { Printing, PrintingImage } from "@openrift/shared/types/catalog";

import { useCards } from "@/features/cards/hooks/use-cards";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";

interface PreferredPrintingHelpers {
  getPreferredPrinting: (
    cardId: string,
    preferredPrintingId?: string | null,
  ) => Printing | undefined;
  getPreferredFrontImage: (
    cardId: string,
    preferredPrintingId?: string | null,
  ) => PrintingImage | undefined;
  getFaceImage: (cardId: string, faceId?: string | null) => PrintingImage | undefined;
  faceOf: (cardId: string, printingId?: string | null) => string | null;
}

export function usePreferredPrinting(): PreferredPrintingHelpers {
  "use memo";

  const { printingsByCardId } = useCards();
  const effectiveLanguageOrder = useEffectiveLanguageOrder();

  const getPreferredPrinting = (
    cardId: string,
    preferredPrintingId?: string | null,
  ): Printing | undefined => {
    const candidates = printingsByCardId.get(cardId);
    if (!candidates) {
      return undefined;
    }
    if (preferredPrintingId) {
      const match = candidates.find((p) => p.printingId === preferredPrintingId);
      if (match) {
        return match;
      }
    }
    return preferredPrinting(candidates, effectiveLanguageOrder);
  };

  const getPreferredFrontImage = (
    cardId: string,
    preferredPrintingId?: string | null,
  ): PrintingImage | undefined => {
    const printing = getPreferredPrinting(cardId, preferredPrintingId);
    return printing?.images[0];
  };

  const getFaceImage = (cardId: string, faceId?: string | null): PrintingImage | undefined => {
    const side = faceId
      ? printingsByCardId.get(cardId)?.find((candidate) => candidate.faceId === faceId)
      : undefined;
    return side?.images[0] ?? getPreferredFrontImage(cardId);
  };

  const faceOf = (cardId: string, printingId?: string | null): string | null =>
    getPreferredPrinting(cardId, printingId)?.faceId ?? null;

  return { getPreferredPrinting, getPreferredFrontImage, getFaceImage, faceOf };
}
