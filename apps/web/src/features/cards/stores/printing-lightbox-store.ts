import { create } from "zustand";

interface PrintingLightboxState {
  requestedSideKey: string | null;
  request: (printingSideKey: string) => void;
  clear: () => void;
}

export const usePrintingLightboxStore = create<PrintingLightboxState>()((set) => ({
  requestedSideKey: null,
  request: (printingSideKey) => set({ requestedSideKey: printingSideKey }),
  clear: () => set({ requestedSideKey: null }),
}));
