// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDisplayStore } from "@/stores/display-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import { CardPageHero } from "./card-page-hero";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
  useNavigate: () => vi.fn(),
}));

const hydration = { hydrated: true };
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => hydration.hydrated }));

const resetDisplayStore = createStoreResetter(useDisplayStore);

afterEach(() => {
  resetDisplayStore();
  hydration.hydrated = true;
});

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const withArt = () =>
  stubPrinting({
    images: [{ imageId: "019d6c25-b081-74b3-a901-64da4ae0abcd" }],
    card: { name: "Hero Card" },
  });

describe("CardPageHero", () => {
  it("flags a printing from an unreleased set with the preview ribbon", () => {
    const printing = stubPrinting({ setReleased: false });
    const { getByText } = render(
      <CardPageHero printing={printing} siblings={[printing]} otherCardSides={[]} />,
      { wrapper: Wrapper },
    );
    expect(getByText("Preview")).toBeInTheDocument();
  });

  it("asks for an image when the printing has none and no stand-in art exists", () => {
    const printing = stubPrinting({ images: [] });
    const { getByText } = render(
      <CardPageHero printing={printing} siblings={[printing]} otherCardSides={[]} />,
      { wrapper: Wrapper },
    );
    expect(getByText("Placeholder")).toBeInTheDocument();
  });

  it("renders the art before hydration even when the viewer turned images off", () => {
    hydration.hydrated = false;
    useDisplayStore.getState().setShowImages(false);
    const printing = withArt();
    const { queryByAltText } = render(
      <CardPageHero printing={printing} siblings={[printing]} otherCardSides={[]} />,
      { wrapper: Wrapper },
    );
    expect(queryByAltText("Hero Card")).not.toBeNull();
  });

  it("follows the viewer's images-off preference once hydrated", () => {
    useDisplayStore.getState().setShowImages(false);
    const printing = withArt();
    const { queryByAltText } = render(
      <CardPageHero printing={printing} siblings={[printing]} otherCardSides={[]} />,
      { wrapper: Wrapper },
    );
    expect(queryByAltText("Hero Card")).toBeNull();
  });
});
