import { create } from "zustand";
import { persist } from "zustand/middleware";

import { SCAN_ZOOMS } from "@/features/scan/lib/scan-zoom";

const DEFAULT_SCAN_LANGUAGE = "EN";

const LEGACY_IDENTIFY_ONLY = "identify-only";

interface ScanPrefsState {
  muted: boolean;
  setMuted: (value: boolean) => void;
  destinationCollectionId: string | null;
  setDestinationCollectionId: (value: string | null) => void;
  cardLanguage: string | null;
  setCardLanguage: (value: string | null) => void;
  tapToScan: boolean;
  setTapToScan: (value: boolean) => void;
  zoom: number;
  setZoom: (value: number) => void;
}

function isScanZoom(value: unknown): value is number {
  return SCAN_ZOOMS.some((zoom) => zoom === value);
}

function mergeDestination(raw: Record<string, unknown>, current: string | null): string | null {
  if (typeof raw.destinationCollectionId === "string") {
    return raw.destinationCollectionId;
  }
  if (raw.destinationCollectionId === null) {
    return null;
  }
  const legacy = raw.targetCollectionId;
  if (typeof legacy === "string" && legacy !== LEGACY_IDENTIFY_ONLY) {
    return legacy;
  }
  return current;
}

export const useScanPrefsStore = create<ScanPrefsState>()(
  persist(
    (set) => ({
      muted: false,
      setMuted: (value) => set({ muted: value }),
      destinationCollectionId: null,
      setDestinationCollectionId: (value) => set({ destinationCollectionId: value }),
      cardLanguage: DEFAULT_SCAN_LANGUAGE,
      setCardLanguage: (value) => set({ cardLanguage: value }),
      tapToScan: false,
      setTapToScan: (value) => set({ tapToScan: value }),
      zoom: 1,
      setZoom: (value) => set({ zoom: value }),
    }),
    {
      name: "openrift-scan-prefs",
      partialize: (state) => ({
        muted: state.muted,
        destinationCollectionId: state.destinationCollectionId,
        cardLanguage: state.cardLanguage,
        tapToScan: state.tapToScan,
        zoom: state.zoom,
      }),
      merge: (persisted, current) => {
        const raw = (persisted as Record<string, unknown>) ?? {};
        // null is a stored value here ("any language"), not a missing one.
        const language =
          typeof raw.cardLanguage === "string" || raw.cardLanguage === null
            ? raw.cardLanguage
            : current.cardLanguage;
        return {
          ...current,
          muted: typeof raw.muted === "boolean" ? raw.muted : current.muted,
          destinationCollectionId: mergeDestination(raw, current.destinationCollectionId),
          cardLanguage: language,
          tapToScan: typeof raw.tapToScan === "boolean" ? raw.tapToScan : current.tapToScan,
          zoom: isScanZoom(raw.zoom) ? raw.zoom : current.zoom,
        };
      },
    },
  ),
);
