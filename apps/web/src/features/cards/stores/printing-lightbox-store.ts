import { create } from "zustand";

interface PrintingLightboxState {
  requestedSideKey: string | null;
  pickedSideKey: string | null;
  request: (printingSideKey: string) => void;
  clear: () => void;
  pick: (printingSideKey: string) => void;
  clearPicked: () => void;
}

export const usePrintingLightboxStore = create<PrintingLightboxState>()((set) => ({
  requestedSideKey: null,
  pickedSideKey: null,
  request: (printingSideKey) => set({ requestedSideKey: printingSideKey }),
  clear: () => set({ requestedSideKey: null }),
  pick: (printingSideKey) => set({ pickedSideKey: printingSideKey }),
  clearPicked: () => set({ pickedSideKey: null }),
}));
