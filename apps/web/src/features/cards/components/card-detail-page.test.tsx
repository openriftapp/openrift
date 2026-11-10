import type { Printing } from "@openrift/shared/types/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

import { cardsKeys, catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { stubPrinting } from "@/test/factories";

import { CardDetailPage } from "./card-detail-page";

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({
    useParams: () => ({ cardSlug: "ezreal", printingSlug: undefined }),
    useSearch: () => ({}),
  }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => false,
}));

vi.mock("@/components/layout/page-top-bar", () => {
  function Pass({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  return {
    PageTopBar: Pass,
    PageTopBarActions: Pass,
    PageTopBarBack: () => null,
    PageTopBarButton: () => null,
    PageTopBarSticky: Pass,
    PageTopBarTitle: Pass,
  };
});

vi.mock("@/features/cards/components/card-page-collection-slot", () => ({
  CollectionSlot: () => null,
  SignupNudgeSlot: () => null,
}));
vi.mock("@/features/cards/components/card-page-fact-rows", () => ({
  CardPageFactRows: () => null,
}));
vi.mock("@/features/cards/components/card-page-hero", () => ({ CardPageHero: () => null }));
vi.mock("@/features/cards/components/card-page-info-table", () => ({
  CardPageInfoTable: () => null,
}));
vi.mock("@/features/cards/components/card-page-price-history", () => ({
  PriceHistorySection: () => null,
}));
vi.mock("@/features/cards/components/card-page-related-cards", () => ({
  RelatedCardsSection: () => null,
}));
vi.mock("@/features/cards/components/card-page-share-button", () => ({
  ShareCardButton: () => null,
}));
vi.mock("@/features/cards/components/suggest-correction-menu", () => ({
  SuggestCorrectionMenu: () => null,
}));
vi.mock("@/lib/site-config", () => ({ getSiteUrl: () => "https://example.test" }));

vi.mock("@/hooks/use-effective-language-order", () => ({
  useEffectiveLanguageOrder: () => ["EN"],
}));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { finishes: {}, artVariants: {}, cardSizes: {} } }),
  useLanguageLabels: () => ({ EN: "English" }),
}));
vi.mock("@/components/language-chip", () => ({
  LanguageChip: ({ code }: { code: string }) => <span>{code}</span>,
}));
vi.mock("@/features/cards/components/card-art-thumb", () => ({ CardArtThumb: () => null }));
vi.mock("@/features/cards/components/card-detail/card-detail-art", () => ({
  CardDetailArt: () => null,
}));
vi.mock("@/hooks/use-session", () => ({ useUserId: () => null }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/features/cards/hooks/use-prices", () => ({
  usePrices: () => ({ get: () => undefined }),
}));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCountsForPrintings: () => ({ data: undefined }),
}));

const SET_ID = "00000000-0000-0000-0000-00000000set1";

function toWireFace(printing: Printing) {
  const {
    printingId: _id,
    side: _side,
    otherSide: _other,
    setSlug: _slug,
    setReleased: _released,
    card: _card,
    ...value
  } = printing;
  return { ...value, setId: SET_ID, markers: [], distributionChannels: [] };
}

function seedCardDetail() {
  const single = stubPrinting({ printingId: "p-single", cardId: "card-1", language: "EN" });
  const front = stubPrinting({
    printingId: "p-double",
    cardId: "card-1",
    language: "EN",
    shortCode: "OGN-002",
  });
  const back = stubPrinting({
    printingId: "p-double",
    cardId: "card-2",
    language: "EN",
    shortCode: "OGN-003",
    card: { name: "Gold" },
  });
  const { id: _id, ...backCard } = { ...back.card, id: "card-2" };
  return {
    card: { ...single.card, id: "card-1", slug: "ezreal", name: "Ezreal" },
    cards: { "card-2": backCard },
    printings: {
      "p-single": toWireFace(single),
      "p-double": { ...toWireFace(front), side2: toWireFace(back) },
    },
    sets: [
      {
        id: SET_ID,
        slug: "ogn",
        name: "Origins",
        releases: { EN: { releasedAt: "2025-01-01", precision: "day" } },
      },
    ],
    markers: [],
    distributionChannels: [],
    products: [],
    related: [],
  };
}

describe("CardDetailPage", () => {
  it("renders its printings from the card's own payload without loading the whole catalog", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(cardsKeys.detail("ezreal"), seedCardDetail());

    render(
      <QueryClientProvider client={client}>
        <Suspense fallback={<p>suspended</p>}>
          <CardDetailPage />
        </Suspense>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("button", { name: /flip to.*gold/iu, hidden: true }),
    ).toBeTruthy();
    expect(screen.queryByText("suspended")).toBeNull();
    expect(client.getQueryCache().find({ queryKey: catalogKeys.all, exact: true })).toBeUndefined();
  });
});
