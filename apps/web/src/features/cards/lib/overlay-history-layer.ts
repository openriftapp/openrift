import { createContext } from "react";

export type OverlayHistoryKey =
  | "cardDetail"
  | "deckSheet"
  | "missingCardDetail"
  | "paletteCardDetail"
  | "printingLightbox";

/** Identity of one overlay's history entry, handed to the overlays nested inside it. */
export type OverlayLayerId = Readonly<{ stateKey: OverlayHistoryKey }>;

export interface OverlayHistoryLayer {
  id: OverlayLayerId;
  active: boolean;
}

export const OverlayHistoryLayerContext = createContext<OverlayHistoryLayer | null>(null);
