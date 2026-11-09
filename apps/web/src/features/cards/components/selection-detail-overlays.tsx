import type { Printing } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";

import type { CardDetailDeckBuilding } from "@/features/cards/components/card-detail/card-detail";
import { SelectionDetailModal } from "@/features/cards/components/selection-detail-modal";
import { SelectionMobileOverlay } from "@/features/cards/components/selection-mobile-overlay";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { CardViewerItem } from "@/lib/card-viewer-types";

interface SelectionDetailOverlaysProps {
  items: CardViewerItem[];
  printingsByCardId: Map<string, Printing[]>;
  showImages: boolean;
  onSearchAndClose: (query: string) => void;
  actions?: (printing: Printing) => ReactNode;
  deckBuilding?: (printing: Printing) => CardDetailDeckBuilding | undefined;
  collectionId?: string;
  docking?: boolean;
}

export function SelectionDetailOverlays(props: SelectionDetailOverlaysProps) {
  const isMobile = useIsMobile();
  return isMobile ? <SelectionMobileOverlay {...props} /> : <SelectionDetailModal {...props} />;
}
