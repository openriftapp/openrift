import { lazy, Suspense } from "react";

import { useTradeCancelConsentStore } from "@/features/groups/stores/trade-cancel-consent-store";

// Mounted in the app layout, which every page loads: the dialog and the catalog stay lazy.
const TradeCancelConsentPrompt = lazy(async () => {
  const mod = await import("@/features/groups/components/trade-cancel-consent-prompt");
  return { default: mod.TradeCancelConsentPrompt };
});

export function TradeCancelConsentHost() {
  const request = useTradeCancelConsentStore((state) => state.request);
  if (request === null) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <TradeCancelConsentPrompt trades={request.trades} />
    </Suspense>
  );
}
