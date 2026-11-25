import { labelMapOf } from "@openrift/shared/enum-label";
import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardThumbnail } from "@/features/cards/components/card-thumbnail";
import type { CardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import { stubPrinting } from "@/test/factories";

vi.mock("@/hooks/use-viewer-legality", () => ({
  useViewerLegality: () => ({ windows: [] }),
  useGlobalLegality: () => ({ windows: [] }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useRouter: () => ({ preloadRoute: vi.fn(), options: { defaultPreloadDelay: 50 } }),
}));

const display: CardThumbnailDisplay = {
  fancyFan: true,
  gridFoil: false,
  coarsePointer: false,
  domainColors: {},
  finishLabels: labelMapOf({}),
  sizeLabels: labelMapOf({}),
  rarityLabels: labelMapOf({}),
  prices: EMPTY_PRICE_LOOKUP,
  favoriteMarketplace: "cardtrader",
  compactFmt: String,
  getFallbackArt: () => null,
};

function withInit(node: ReactNode) {
  const client = new QueryClient();
  client.setQueryData(["init"], {
    enums: {
      cardTypes: [],
      rarities: [],
      domains: [],
      superTypes: [],
      finishes: [],
      artVariants: [],
      deckFormats: [],
      deckZones: [],
      formats: [],
      languages: [],
    },
    keywords: {},
  });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

afterEach(() => {
  useGridFocusStore.setState({ flashCardId: null });
});

describe("CardThumbnail selection flash", () => {
  it("ends the flash when its animation finishes", () => {
    const printing = stubPrinting({ images: [{ imageId: "flash-image-id-aa" }] });
    useGridFocusStore.setState({ flashCardId: printing.printingId });
    const { container } = render(
      withInit(
        <CardThumbnail
          printing={printing}
          onClick={() => {}}
          showImages
          isFlashing
          display={display}
        />,
      ),
    );
    const overlay = [...container.querySelectorAll<HTMLElement>("div")].find((element) =>
      element.style.animation.includes("selection-flash"),
    );
    expect(overlay).toBeDefined();

    fireEvent.animationEnd(overlay as HTMLElement);

    expect(useGridFocusStore.getState().flashCardId).toBeNull();
  });
});
