import { create } from "zustand";
import { persist } from "zustand/middleware";

import { SCAN_ZOOMS } from "@/features/scan/lib/scan-zoom";
import type { FieldPicker } from "@/lib/persist-merge";
import { mergeFields, pickBoolean, pickNullableString } from "@/lib/persist-merge";

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

const pickDestination: FieldPicker<string | null> = (value, persisted) => {
  const stored = pickNullableString(value, persisted);
  if (stored !== undefined) {
    return stored;
  }
  const legacy = persisted?.targetCollectionId;
  return typeof legacy === "string" && legacy !== LEGACY_IDENTIFY_ONLY ? legacy : undefined;
};

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
      merge: mergeFields<ScanPrefsState>({
        muted: pickBoolean,
        destinationCollectionId: pickDestination,
        cardLanguage: pickNullableString,
        tapToScan: pickBoolean,
        zoom: (value) => (isScanZoom(value) ? value : undefined),
      }),
    },
  ),
);
